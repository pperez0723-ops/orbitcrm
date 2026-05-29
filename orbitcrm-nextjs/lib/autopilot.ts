// lib/autopilot.ts — the orchestrator that makes OrbitCRM work leads FOR you.
// For each contact it: scores → summarizes → drafts outreach → decides what
// to do based on score → either queues a suggestion (Suggest mode) or acts
// directly (Auto mode). Guardrails: DND, daily action cap.
//
// Runs from: the cron worker (real-time on new leads + daily sweep) and the
// manual "Run Autopilot" button.
import { SupabaseClient } from '@supabase/supabase-js';

const KEY = () => process.env.CLAUDE_API_KEY!;
const MODEL = 'claude-sonnet-4-6';

async function ask(system: string, content: string, maxTokens = 600): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}
function pj<T>(t: string, f: T): T { try { return JSON.parse(t.replace(/```json|```/g, '').trim()); } catch { return f; } }

export interface AutopilotSettings {
  mode: 'off' | 'suggest' | 'auto';
  respect_dnd: boolean; max_actions_day: number;
  hot_threshold: number; cold_threshold: number;
  nurture_automation_id: string | null;
}

// Process ONE contact through the full autopilot chain.
export async function runAutopilotForContact(
  admin: SupabaseClient, ws: string, contact: any, settings: AutopilotSettings
): Promise<{ acted: boolean; kind?: string; detail?: string }> {
  if (settings.mode === 'off') return { acted: false };

  // ── 1. Score with reasoning ──
  const scoreOut = pj(await ask(
    `Score this lead 0-100 with reasoning. JSON only: {"score":n,"reason":"one line"}`,
    JSON.stringify({ name: `${contact.fname} ${contact.lname || ''}`, company: contact.company, source: contact.source, email: contact.email, phone: contact.phone }),
    250
  ), { score: 0, reason: '' });
  const score = Math.max(0, Math.min(100, Number(scoreOut.score) || 0));
  await admin.from('contacts').update({ score }).eq('id', contact.id);

  // ── 2. Summarize + next step ──
  const sumOut = pj(await ask(
    `Summarize this lead for a rep + give the single best next step. JSON only: {"summary":"1-2 sentences","next_step":"short action"}`,
    JSON.stringify({ name: contact.fname, company: contact.company, source: contact.source, score, reason: scoreOut.reason }),
    300
  ), { summary: '', next_step: '' });

  // ── 3. Decide the play based on score ──
  let kind: 'call' | 'email' | 'nurture';
  if (score >= settings.hot_threshold) kind = 'call';
  else if (score <= settings.cold_threshold) kind = 'nurture';
  else kind = 'email';

  // ── 4. Draft outreach (for email/call kinds) ──
  let subject = '', bodyText = '';
  if (kind !== 'nurture') {
    const draft = pj(await ask(
      `Write a short, warm first-touch ${kind === 'call' ? 'call-opener note and a backup email' : 'outreach email'} for this lead. JSON only: {"subject":"...","body":"..."}`,
      JSON.stringify({ name: contact.fname, company: contact.company, source: contact.source }),
      500
    ), { subject: '', body: '' });
    subject = draft.subject || ''; bodyText = draft.body || '';
  }

  // ── 5. Guardrails ──
  const dndBlocked = settings.respect_dnd && ((kind === 'email' && contact.dnd_email) || contact.dnd_sms);

  // ── 6. Act (suggest vs auto) ──
  if (settings.mode === 'suggest' || dndBlocked) {
    // queue a suggestion for human approval
    await admin.from('autopilot_suggestions').insert({
      workspace_id: ws, contact_id: contact.id, kind, score,
      reason: scoreOut.reason, summary: sumOut.summary,
      draft_subject: subject, draft_body: bodyText || sumOut.next_step,
      status: 'pending',
    });
    await logActivity(admin, ws, contact.id, `Autopilot suggested: ${kind} (score ${score})`);
    return { acted: true, kind, detail: 'suggested' };
  }

  // AUTO mode — actually do it
  if (kind === 'call') {
    await admin.from('tasks').insert({
      workspace_id: ws, contact_id: contact.id, priority: 'high',
      title: `🔥 Call ${contact.fname} ${contact.lname || ''} — hot lead (${score})`,
      notes: `${sumOut.summary}\nNext: ${sumOut.next_step}`,
      due_date: new Date().toISOString().slice(0, 10),
    });
  } else if (kind === 'nurture' && settings.nurture_automation_id) {
    await enroll(admin, ws, settings.nurture_automation_id, contact.id);
  } else if (kind === 'email') {
    // queue an outbound message row (the worker/send layer dispatches it)
    await ensureConversationAndQueue(admin, ws, contact, subject, bodyText);
  }
  await admin.from('autopilot_suggestions').insert({
    workspace_id: ws, contact_id: contact.id, kind, score, reason: scoreOut.reason,
    summary: sumOut.summary, draft_subject: subject, draft_body: bodyText,
    status: 'executed', acted_at: new Date().toISOString(),
  });
  await logActivity(admin, ws, contact.id, `Autopilot executed: ${kind} (score ${score})`);
  return { acted: true, kind, detail: 'executed' };
}

async function logActivity(admin: SupabaseClient, ws: string, contactId: string, text: string) {
  await admin.from('activity').insert({ workspace_id: ws, contact_id: contactId, kind: 'autopilot', text, icon: 'ti-robot' });
}

async function enroll(admin: SupabaseClient, ws: string, automationId: string, contactId: string) {
  const { data: nodes } = await admin.from('automation_nodes').select('id,is_entry,next_node_id').eq('automation_id', automationId);
  const entry = (nodes || []).find((n: any) => n.is_entry);
  const first = entry?.next_node_id;
  if (!first) return;
  const { data: enr } = await admin.from('enrollments').insert({
    workspace_id: ws, automation_id: automationId, contact_id: contactId, current_node_id: first, status: 'active',
  }).select('id').single();
  if (enr) await admin.from('automation_runs').insert({
    workspace_id: ws, enrollment_id: enr.id, node_id: first, run_at: new Date().toISOString(), status: 'pending',
  });
}

async function ensureConversationAndQueue(admin: SupabaseClient, ws: string, contact: any, subject: string, body: string) {
  let convId: string;
  const { data: existing } = await admin.from('conversations').select('id')
    .eq('workspace_id', ws).eq('contact_id', contact.id).eq('channel', 'email').maybeSingle();
  if (existing) convId = existing.id;
  else {
    const { data: c } = await admin.from('conversations').insert({
      workspace_id: ws, contact_id: contact.id, channel: 'email',
    }).select('id').single();
    convId = c!.id;
  }
  await admin.from('messages').insert({
    workspace_id: ws, conversation_id: convId, contact_id: contact.id,
    channel: 'email', direction: 'out', subject, body, status: 'queued',
  });
}

// Load settings (with defaults if none set).
export async function getSettings(admin: SupabaseClient, ws: string): Promise<AutopilotSettings> {
  const { data } = await admin.from('autopilot_settings').select('*').eq('workspace_id', ws).maybeSingle();
  return {
    mode: data?.mode || 'off',
    respect_dnd: data?.respect_dnd ?? true,
    max_actions_day: data?.max_actions_day ?? 50,
    hot_threshold: data?.hot_threshold ?? 70,
    cold_threshold: data?.cold_threshold ?? 35,
    nurture_automation_id: data?.nurture_automation_id || null,
  };
}

// How many autopilot actions already taken today (cap guard).
export async function actionsToday(admin: SupabaseClient, ws: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await admin.from('autopilot_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', ws).gte('created_at', start.toISOString());
  return count || 0;
}
