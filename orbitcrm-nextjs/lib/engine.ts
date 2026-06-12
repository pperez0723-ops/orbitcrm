// lib/engine.ts — shared automation engine.
// Lets the app fire automations INSTANTLY when a contact is created,
// instead of waiting for the daily Vercel cron (Hobby plan = 1 run/day).
// The cron still handles delayed steps ("wait 3 days then send").
import { SupabaseClient } from '@supabase/supabase-js';
import { getCreds, sendEmail, sendSMS, mergeTags } from './providers';

// Enroll a contact into every ACTIVE automation with the given trigger
// (skips automations the contact is already enrolled in).
export async function enrollContactInTrigger(
  admin: SupabaseClient, ws: string, contactId: string, trigger: string
): Promise<string[]> {
  const { data: autos } = await admin.from('automations')
    .select('id').eq('workspace_id', ws).eq('trigger', trigger).eq('active', true);
  const enrolled: string[] = [];

  for (const a of autos || []) {
    const { data: existing } = await admin.from('enrollments')
      .select('id').eq('automation_id', a.id).eq('contact_id', contactId).limit(1).maybeSingle();
    if (existing) continue;

    const { data: nodes } = await admin.from('automation_nodes')
      .select('id,is_entry,next_node_id').eq('automation_id', a.id);
    const entry = (nodes || []).find((n: any) => n.is_entry);
    const first = entry?.next_node_id;
    if (!first) continue;

    const { data: enr } = await admin.from('enrollments').insert({
      workspace_id: ws, automation_id: a.id, contact_id: contactId,
      current_node_id: first, status: 'active',
    }).select('id').single();
    if (!enr) continue;

    await admin.from('automation_runs').insert({
      workspace_id: ws, enrollment_id: enr.id, node_id: first,
      run_at: new Date().toISOString(), status: 'pending',
    });
    enrolled.push(a.id);
  }
  return enrolled;
}

// Execute this contact's DUE pending runs RIGHT NOW (walks the chain through
// instant nodes — send_sms / send_email / add_tag / condition — and stops at
// the first 'wait', leaving it for the cron). Max 10 hops as a safety cap.
export async function processContactRunsNow(
  admin: SupabaseClient, ws: string, contactId: string
): Promise<{ executed: number; errors: string[] }> {
  let executed = 0;
  const errors: string[] = [];

  const { data: enrollments } = await admin.from('enrollments')
    .select('id').eq('workspace_id', ws).eq('contact_id', contactId).eq('status', 'active');

  for (const enr of enrollments || []) {
    for (let hop = 0; hop < 10; hop++) {
      const now = new Date().toISOString();
      const { data: run } = await admin.from('automation_runs')
        .select('*').eq('enrollment_id', enr.id).eq('status', 'pending')
        .lte('run_at', now).order('run_at').limit(1).maybeSingle();
      if (!run) break;

      try {
        const isWaitScheduled = await executeRun(admin, run);
        await admin.from('automation_runs').update({
          status: 'done', processed_at: new Date().toISOString(),
        }).eq('id', run.id);
        executed++;
        if (isWaitScheduled) break; // next step is in the future — cron's job
      } catch (e: any) {
        errors.push(String(e?.message || e));
        await admin.from('automation_runs').update({
          status: 'failed', last_error: String(e),
        }).eq('id', run.id);
        break;
      }
    }
  }
  return { executed, errors };
}

// Same node semantics as the cron worker. Returns true if it scheduled a
// future (delayed) run, false if the next run is immediate / chain ended.
export async function executeRun(admin: SupabaseClient, run: any): Promise<boolean> {
  const { data: node } = await admin.from('automation_nodes').select('*').eq('id', run.node_id).single();
  const { data: enr } = await admin.from('enrollments').select('*').eq('id', run.enrollment_id).single();
  if (!node || !enr) return false;
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
        if (!res.ok) throw new Error(`email: ${res.error}`);
      }
      break;
    case 'send_sms':
      if (contact?.phone && !contact.dnd_sms) {
        const creds = await getCreds(admin, run.workspace_id);
        const res = await sendSMS(creds, contact.phone, mergeTags(node.config?.body || '', contact));
        await logMessage(admin, run.workspace_id, contact, 'sms', null, node.config?.body, res);
        if (!res.ok) throw new Error(`sms: ${res.error}`);
      }
      break;
    case 'add_tag':
      if (contact && node.config?.tag) {
        const tags = Array.from(new Set([...(contact.tags || []), node.config.tag]));
        await admin.from('contacts').update({ tags }).eq('id', contact.id);
      }
      break;
    case 'condition': {
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
    return delayMs > 0;
  }
  await admin.from('enrollments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enr.id);
  return false;
}

async function logMessage(admin: SupabaseClient, ws: string, contact: any, channel: string, subject: any, body: any, res: any) {
  let convId: string;
  const { data: ex } = await admin.from('conversations').select('id')
    .eq('workspace_id', ws).eq('contact_id', contact.id).eq('channel', channel).maybeSingle();
  if (ex) convId = ex.id;
  else {
    const { data: c } = await admin.from('conversations').insert({ workspace_id: ws, contact_id: contact.id, channel }).select('id').single();
    convId = c!.id;
  }
  await admin.from('messages').insert({
    workspace_id: ws, conversation_id: convId, contact_id: contact.id, channel,
    direction: 'out', subject: subject || null, body: body || '',
    status: res?.ok ? 'sent' : 'failed', provider_id: res?.id || null, error: res?.ok ? null : res?.error,
  });
}
