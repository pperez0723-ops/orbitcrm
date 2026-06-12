// lib/ai-tools.ts
// The action layer: functions the AI can call to DO things in OrbitCRM.
// Shared by (a) the in-app OrbitAI assistant and (b) the voice agent's
// server tools. Each tool takes a workspaceId + args and uses the admin
// client (server-side) to read/write the database.
//
// These are exposed to Claude as "tools" (function calling) and to
// ElevenLabs as "server tools" via the /api/voice/* webhooks.

import { SupabaseClient } from '@supabase/supabase-js';

// ── Tool definitions handed to Claude (Anthropic tool-use schema) ──
export const AI_TOOLS = [
  {
    name: 'create_contact',
    description: 'Create a new contact/lead in the CRM.',
    input_schema: {
      type: 'object',
      properties: {
        fname: { type: 'string', description: 'First name' },
        lname: { type: 'string', description: 'Last name' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        source: { type: 'string', enum: ['website', 'referral', 'linkedin', 'cold_outreach', 'form', 'api', 'other'] },
      },
      required: ['fname'],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search contacts by name, email, company, or list recent ones. Returns matching contacts.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text; empty for most recent' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'create_deal',
    description: 'Create a deal/opportunity for a contact in the default pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        title: { type: 'string' },
        value: { type: 'number' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a follow-up task, optionally linked to a contact.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        contact_id: { type: 'string' },
        due_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_automation',
    description: 'Create a simple automation (trigger + ordered steps). Steps can be wait/send_email/send_sms/add_tag.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        trigger: { type: 'string', enum: ['contact_created', 'stage_changed', 'form_submitted', 'tag_added', 'manual'] },
        steps: {
          type: 'array',
          description: 'Ordered steps. Each: {kind, config}. e.g. {kind:"wait",config:{amount:2,unit:"days"}} then {kind:"send_email",config:{subject,body}}',
          items: { type: 'object' },
        },
      },
      required: ['name', 'trigger', 'steps'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get current pipeline: counts and value per stage, plus rotting/cold deals.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ── Tool executors ─────────────────────────────────────────────────
export async function runTool(
  admin: SupabaseClient,
  workspaceId: string,
  name: string,
  args: any
): Promise<any> {
  switch (name) {
    case 'create_contact': {
      const { data, error } = await admin.from('contacts').insert({
        workspace_id: workspaceId,
        fname: args.fname, lname: args.lname || null, email: args.email || null,
        phone: args.phone || null, company: args.company || null,
        source: args.source || 'other',
      }).select().single();
      if (error) return { error: error.message };
      // fire contact_created automations instantly (welcome SMS, etc.)
      try {
        const { enrollContactInTrigger, processContactRunsNow } = await import('./engine');
        await enrollContactInTrigger(admin, workspaceId, data.id, 'contact_created');
        await processContactRunsNow(admin, workspaceId, data.id);
      } catch { /* non-fatal */ }
      return { ok: true, contact: data };
    }

    case 'search_contacts': {
      let q = admin.from('contacts').select('id,fname,lname,email,phone,company,score,source,created_at')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
        .limit(args.limit || 10);
      if (args.query) {
        q = q.or(`fname.ilike.%${args.query}%,lname.ilike.%${args.query}%,company.ilike.%${args.query}%,email.ilike.%${args.query}%`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { ok: true, contacts: data, count: data?.length || 0 };
    }

    case 'create_deal': {
      // find default pipeline + first stage
      const { data: pl } = await admin.from('pipelines').select('id')
        .eq('workspace_id', workspaceId).eq('is_default', true).limit(1).single();
      if (!pl) return { error: 'No pipeline found' };
      const { data: stage } = await admin.from('stages').select('id')
        .eq('pipeline_id', pl.id).order('sort_order').limit(1).single();
      const { data, error } = await admin.from('deals').insert({
        workspace_id: workspaceId, contact_id: args.contact_id, pipeline_id: pl.id,
        stage_id: stage!.id, title: args.title || 'New Deal', value: args.value || 0,
      }).select().single();
      if (error) return { error: error.message };
      return { ok: true, deal: data };
    }

    case 'create_task': {
      const { data, error } = await admin.from('tasks').insert({
        workspace_id: workspaceId, title: args.title, contact_id: args.contact_id || null,
        due_date: args.due_date || null, priority: args.priority || 'medium',
      }).select().single();
      if (error) return { error: error.message };
      return { ok: true, task: data };
    }

    case 'create_automation': {
      const { data: auto, error } = await admin.from('automations').insert({
        workspace_id: workspaceId, name: args.name, trigger: args.trigger, active: false,
      }).select().single();
      if (error) return { error: error.message };
      // entry/trigger node
      const { data: entry } = await admin.from('automation_nodes').insert({
        workspace_id: workspaceId, automation_id: auto.id, kind: 'trigger', is_entry: true, label: 'Trigger',
      }).select().single();
      // build the step chain
      let prevId = entry!.id;
      const stepIds: string[] = [];
      for (const step of args.steps || []) {
        const { data: node } = await admin.from('automation_nodes').insert({
          workspace_id: workspaceId, automation_id: auto.id,
          kind: step.kind, config: step.config || {}, label: step.kind,
        }).select().single();
        await admin.from('automation_nodes').update({ next_node_id: node!.id }).eq('id', prevId);
        prevId = node!.id; stepIds.push(node!.id);
      }
      return { ok: true, automation: auto, steps: stepIds.length };
    }

    case 'get_pipeline_summary': {
      const { data: stages } = await admin.from('stages').select('id,name,probability')
        .eq('workspace_id', workspaceId).order('sort_order');
      const { data: deals } = await admin.from('deals').select('stage_id,value,last_activity_at,title')
        .eq('workspace_id', workspaceId);
      const now = Date.now();
      const byStage = (stages || []).map((s: any) => {
        const ds = (deals || []).filter((d: any) => d.stage_id === s.id);
        return { stage: s.name, count: ds.length, value: ds.reduce((a: number, d: any) => a + Number(d.value || 0), 0) };
      });
      const rotting = (deals || []).filter((d: any) =>
        d.last_activity_at && (now - new Date(d.last_activity_at).getTime()) > 7 * 86400e3)
        .map((d: any) => ({ title: d.title, value: d.value }));
      return { ok: true, byStage, rotting, totalDeals: deals?.length || 0 };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
