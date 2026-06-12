// app/api/crew/route.ts — REAL agent crew, streamed live (Claude Code style).

// A Director plans the order, then sub-agents (Researcher / Web Dev / App Dev)

// each run a real Claude call. App Dev runs the full tool-use loop so it

// ACTUALLY acts on the workspace DB (create contacts, automations, etc.).

// Every step is streamed to the browser as Server-Sent Events so the UI can

// render it live like a terminal.

import { NextRequest } from 'next/server';

import { createClient, createAdmin } from '@/lib/supabase-server';

import { AI_TOOLS, runTool } from '@/lib/ai-tools';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const KEY = () => process.env.CLAUDE_API_KEY;

async function callClaude(payload: any) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY()!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, ...payload }),
  });
  return r.json();
}

function textOf(data: any): string {
  return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}

export async function POST(req: NextRequest) {
  if (!KEY()) return new Response('CLAUDE_API_KEY not set', { status: 500 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const { data: mem } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const workspaceId = mem?.workspace_id;
  if (!workspaceId) return new Response('no workspace', { status: 400 });

  let order = '';
  try { order = (await req.json()).order || ''; } catch {}
  if (!order.trim()) return new Response('order required', { status: 400 });

  const admin = createAdmin();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        send('system', { msg: `Order received: "${order}"` });

        // ---------- DIRECTOR: plan the work ----------
        send('agent_start', { agent: 'director', label: 'Director — planning' });

        const planRaw = await callClaude({
          max_tokens: 700,
          system:
            'You are the Director of an autonomous LEAD GENERATION crew inside OrbitCRM (a CRM app). ' +
            'Your crew\'s #1 job is getting leads into the CRM. Given the user\'s order, decide which crew members are needed and give each a clear task. ' +
            'Crew: "leadgen" (THE PRIMARY AGENT — prospects, qualifies, and CREATES real leads/contacts in the CRM via tools, plus deals and follow-up tasks for hot ones), ' +
            '"researcher" (gathers intel & analyzes CRM data to find target markets and ideal customer profiles), ' +
            '"appdev" (executes other CRM actions via tools: automations, pipeline work, bulk updates). ' +
            'For anything involving leads, prospects, outreach, or growing the pipeline → use leadgen. ' +
            'Respond ONLY with JSON: {"summary":"one line","steps":[{"agent":"leadgen","task":"..."}]}. Use 1-3 steps, only the agents truly needed.',
          messages: [{ role: 'user', content: order }],
        });

        if (planRaw.error) { send('error', { msg: planRaw.error.message || 'planning failed' }); controller.close(); return; }

        let plan: any;
        try { plan = JSON.parse(textOf(planRaw).replace(/```json|```/g, '').trim()); }
        catch { plan = { summary: 'Direct execution', steps: [{ agent: 'appdev', task: order }] }; }

        const steps = Array.isArray(plan.steps) && plan.steps.length ? plan.steps : [{ agent: 'appdev', task: order }];

        send('director_plan', { summary: plan.summary || '', crew: steps.map((s: any) => s.agent) });
        send('agent_done', { agent: 'director' });
        await sleep(150);

        // ---------- CREW: run each step for real ----------
        for (const step of steps) {
          const agent = ['researcher', 'webdev', 'appdev', 'leadgen'].includes(step.agent) ? step.agent : 'leadgen';
          const task = step.task || order;

          send('agent_start', { agent, label: `${agent} — working`, task });

          if (agent === 'appdev' || agent === 'leadgen') {
            // REAL agentic tool loop — actually acts on the DB.
            const system = agent === 'leadgen'
              ? 'You are the Lead Gen agent for this OrbitCRM workspace. Your job is to GET LEADS. ' +
                'Use the tools to ACTUALLY create qualified prospect contacts in the CRM (realistic names, ' +
                'companies, emails, phones matched to the target market in the task), set a fitting source, ' +
                'create deals for the strongest prospects, and add follow-up tasks for the hottest ones. ' +
                'Be decisive: call tools to make real changes, then briefly report how many leads you added. ' +
                'Do not ask for confirmation.'
              : 'You are the App Dev agent for this OrbitCRM workspace. Use the available tools to ACTUALLY ' +
                'perform the task in the database. Be decisive: call tools to make real changes, then briefly ' +
                'confirm what you did. Do not ask for confirmation.';

            const convo: any[] = [{ role: 'user', content: task }];

            for (let turn = 0; turn < 4; turn++) {
              const data = await callClaude({
                max_tokens: 1200,
                system,
                messages: convo,
                tools: AI_TOOLS,
              });

              if (data.error) { send('line', { agent, cls: 'warn', text: data.error.message || 'AI error' }); break; }

              const toolUses = (data.content || []).filter((b: any) => b.type === 'tool_use');
              const t = textOf(data);
              if (t) send('line', { agent, cls: 'info', text: t });
              if (!toolUses.length || data.stop_reason !== 'tool_use') break;

              convo.push({ role: 'assistant', content: data.content });

              const results = [];
              for (const tu of toolUses) {
                send('line', { agent, cls: 'cmd', text: `$ ${tu.name} ${JSON.stringify(tu.input)}` });
                const out = await runTool(admin, workspaceId, tu.name, tu.input);
                send('line', { agent, cls: 'ok', text: `✓ ${tu.name} → ${JSON.stringify(out).slice(0, 160)}` });
                results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
              }
              convo.push({ role: 'user', content: results });
            }

          } else if (agent === 'researcher') {
            // Real analysis grounded in this workspace's data.
            const [{ count: contacts }, { data: deals }] = await Promise.all([
              admin.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
              admin.from('deals').select('value').eq('workspace_id', workspaceId),
            ]);
            const pipeline = (deals || []).reduce((s: number, d: any) => s + Number(d.value || 0), 0);

            const out = await callClaude({
              max_tokens: 900,
              system: 'You are the Researcher agent. Produce a concise, concrete brief (5-8 short bullet lines, no fluff). Ground it in the data provided.',
              messages: [{ role: 'user', content: `Task: ${task}\n\nWorkspace data: ${contacts || 0} contacts, pipeline value $${pipeline}.` }],
            });

            if (out.error) send('line', { agent, cls: 'warn', text: out.error.message });
            else textOf(out).split('\n').filter(Boolean).forEach((ln) => send('line', { agent, cls: 'info', text: ln }));

          } else {
            // Web Dev: generate real code/copy.
            const out = await callClaude({
              max_tokens: 1400,
              system: 'You are the Web Dev agent. Produce real, usable output (HTML/JSX/CSS or copy) for the task. Output the code/content directly, concise and production-minded.',
              messages: [{ role: 'user', content: task }],
            });

            if (out.error) send('line', { agent, cls: 'warn', text: out.error.message });
            else textOf(out).split('\n').forEach((ln) => send('line', { agent, cls: 'mut', text: ln }));
            send('line', { agent, cls: 'ok', text: '✓ Draft ready — review and commit when you like it.' });
          }

          send('agent_done', { agent });
          await sleep(120);
        }

        send('done', { msg: 'Mission complete — crew reported in.' });

      } catch (e: any) {
        send('error', { msg: String(e?.message || e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
