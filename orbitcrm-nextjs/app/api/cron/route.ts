// app/api/cron/route.ts — the automation worker.
// Vercel Cron hits this every minute. It claims due runs from the queue
// (claim_due_runs, locked to service_role) and executes each node, then
// schedules the next one. This is the engine that does "wait 3 days then
// send" — the thing a browser can never do.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';
import { runAutopilotForContact, getSettings, actionsToday } from '@/lib/autopilot';
import { getCreds, sendEmail, sendSMS, mergeTags } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // simple shared-secret auth so only Vercel Cron can trigger it
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdmin();
  const { data: runs, error } = await admin.rpc('claim_due_runs', { p_limit: 50 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let processed = 0;
  for (const run of (runs || []) as any[]) {
    try {
      await executeRun(admin, run);
      await admin.from('automation_runs').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', run.id);
      processed++;
    } catch (e: any) {
      await admin.from('automation_runs').update({ status: 'failed', last_error: String(e) }).eq('id', run.id);
    }
  }

  // ── AUTOPILOT: process new leads + (once/hour) a sweep ──
  let autopilot = 0;
  try { autopilot = await runAutopilotSweep(admin); } catch { /* non-fatal */ }

  // ── DISPATCH queued outbound messages (from Autopilot/inbox) ──
  let sent = 0;
  try { sent = await dispatchQueued(admin); } catch { /* non-fatal */ }

  return NextResponse.json({ processed, autopilot, sent });
}

// Send any messages sitting in 'queued' status via the workspace's creds.
async function dispatchQueued(admin: any): Promise<number> {
  const { data: queued } = await admin.from('messages').select('*, contacts(*)')
    .eq('status', 'queued').limit(25);
  let n = 0;
  for (const m of queued || []) {
    const creds = await getCreds(admin, m.workspace_id);
    const c = m.contacts;
    let res: any = { ok: false, error: 'no destination' };
    if (m.channel === 'email' && c?.email) res = await sendEmail(creds, c.email, mergeTags(m.subject || '', c), mergeTags(m.body || '', c));
    else if (m.channel === 'sms' && c?.phone) res = await sendSMS(creds, c.phone, mergeTags(m.body || '', c));
    await admin.from('messages').update({
      status: res.ok ? 'sent' : 'failed', provider_id: res.id || null, error: res.ok ? null : res.error,
    }).eq('id', m.id);
    if (res.ok) n++;
  }
  return n;
}

async function logMessage(admin: any, ws: string, contact: any, channel: string, subject: any, body: any, res: any) {
  // ensure a conversation, then log the sent message
  let convId: string;
  const { data: ex } = await admin.from('conversations').select('id')
    .eq('workspace_id', ws).eq('contact_id', contact.id).eq('channel', channel).maybeSingle();
  if (ex) convId = ex.id;
  else {
    const { data: c } = await admin.from('conversations').insert({ workspace_id: ws, contact_id: contact.id, channel }).select('id').single();
    convId = c.id;
  }
  await admin.from('messages').insert({
    workspace_id: ws, conversation_id: convId, contact_id: contact.id, channel,
    direction: 'out', subject: subject || null, body: body || '',
    status: res?.ok ? 'sent' : 'failed', provider_id: res?.id || null, error: res?.ok ? null : res?.error,
  });
}

// Find workspaces with autopilot on, process their un-actioned recent leads.
async function runAutopilotSweep(admin: any): Promise<number> {
  if (!process.env.CLAUDE_API_KEY) return 0;
  const { data: settingsRows } = await admin.from('autopilot_settings').select('*').neq('mode', 'off');
  let total = 0;
  for (const s of settingsRows || []) {
    const ws = s.workspace_id;
    const settings = await getSettings(admin, ws);
    const already = await actionsToday(admin, ws);
    let budget = Math.max(0, settings.max_actions_day - already);
    if (budget <= 0) continue;

    // contacts created in last 24h that don't yet have an autopilot suggestion
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data: recent } = await admin.from('contacts').select('*')
      .eq('workspace_id', ws).gte('created_at', since).order('created_at', { ascending: false }).limit(10);
    for (const c of recent || []) {
      if (budget <= 0) break;
      const { data: existing } = await admin.from('autopilot_suggestions')
        .select('id').eq('contact_id', c.id).limit(1).maybeSingle();
      if (existing) continue; // already handled this lead
      const r = await runAutopilotForContact(admin, ws, c, settings);
      if (r.acted) { budget--; total++; }
    }
  }
  return total;
}

async function executeRun(admin: any, run: any) {
  // load the node + its enrollment + contact
  const { data: node } = await admin.from('automation_nodes').select('*').eq('id', run.node_id).single();
  const { data: enr } = await admin.from('enrollments').select('*').eq('id', run.enrollment_id).single();
  if (!node || !enr) return;
  const { data: contact } = await admin.from('contacts').select('*').eq('id', enr.contact_id).single();

  let nextNodeId: string | null = node.next_node_id;
  let delayMs = 0;

  switch (node.kind) {
    case 'wait': {
      const cfg = node.config || {};
      const unit = cfg.unit || 'days';
      const amount = Number(cfg.amount) || 1;
      const mult = unit === 'minutes' ? 60e3 : unit === 'hours' ? 3600e3 : 86400e3;
      delayMs = amount * mult;
      break;
    }
    case 'send_email':
      if (contact?.email && !contact.dnd_email) {
        const creds = await getCreds(admin, run.workspace_id);
        const res = await sendEmail(creds, contact.email,
          mergeTags(node.config?.subject || '', contact),
          mergeTags(node.config?.body || '', contact));
        await logMessage(admin, run.workspace_id, contact, 'email', node.config?.subject, node.config?.body, res);
      }
      break;
    case 'send_sms':
      if (contact?.phone && !contact.dnd_sms) {
        const creds = await getCreds(admin, run.workspace_id);
        const res = await sendSMS(creds, contact.phone, mergeTags(node.config?.body || '', contact));
        await logMessage(admin, run.workspace_id, contact, 'sms', null, node.config?.body, res);
      }
      break;
    case 'add_tag':
      if (contact && node.config?.tag) {
        const tags = Array.from(new Set([...(contact.tags || []), node.config.tag]));
        await admin.from('contacts').update({ tags }).eq('id', contact.id);
      }
      break;
    case 'move_stage':
      // update the contact's deal stage based on node.config.stage_id
      break;
    case 'condition': {
      // evaluate and branch
      const cfg = node.config || {};
      const fieldVal = contact?.[cfg.field];
      const pass = cfg.op === 'eq' ? fieldVal === cfg.value : true;
      nextNodeId = pass ? node.branch_true : node.branch_false;
      break;
    }
    default:
      break;
  }

  if (nextNodeId) {
    await admin.from('enrollments').update({ current_node_id: nextNodeId }).eq('id', enr.id);
    await admin.from('automation_runs').insert({
      workspace_id: run.workspace_id,
      enrollment_id: enr.id,
      node_id: nextNodeId,
      run_at: new Date(Date.now() + delayMs).toISOString(),
      status: 'pending',
    });
  } else {
    // no more steps → complete the journey
    await admin.from('enrollments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enr.id);
    await admin.from('automations').update({ completed_count: (run.completed_count || 0) }).eq('id', enr.automation_id).then(() => {}, () => {});
  }
}
