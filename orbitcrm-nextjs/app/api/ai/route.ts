// app/api/ai/route.ts — agentic AI: Claude can call tools to act on the DB.
// The browser sends the user's auth token; we resolve their workspace, then
// run a tool-use loop where Claude can create contacts, automations, etc.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase-server';
import { AI_TOOLS, runTool } from '@/lib/ai-tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const KEY = process.env.CLAUDE_API_KEY;
  if (!KEY) return NextResponse.json({ error: 'CLAUDE_API_KEY not set' }, { status: 500 });

  // who is this + which workspace
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: mem } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const workspaceId = mem?.workspace_id;
  if (!workspaceId) return NextResponse.json({ error: 'no workspace' }, { status: 400 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const { system, messages, max_tokens, allowTools } = body || {};
  if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages[] required' }, { status: 400 });

  const admin = createAdmin();
  const convo = [...messages];
  let finalText = '';
  const actions: any[] = [];

  // agentic loop: call Claude, run any tools, feed results back, repeat
  for (let turn = 0; turn < 5; turn++) {
    const payload: any = {
      model: MODEL, max_tokens: max_tokens || 1200,
      system: system || '', messages: convo,
    };
    if (allowTools !== false) payload.tools = AI_TOOLS;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (data.error) return NextResponse.json({ error: data.error.message || 'AI error' }, { status: 502 });

    // collect text + tool calls from this turn
    const toolUses = (data.content || []).filter((b: any) => b.type === 'tool_use');
    const texts = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text);
    if (texts.length) finalText = texts.join('\n');

    if (toolUses.length === 0 || data.stop_reason !== 'tool_use') {
      break; // done — no more tools to run
    }

    // run each tool, append assistant turn + tool results
    convo.push({ role: 'assistant', content: data.content });
    const results = [];
    for (const tu of toolUses) {
      const out = await runTool(admin, workspaceId, tu.name, tu.input);
      actions.push({ tool: tu.name, input: tu.input, result: out });
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    convo.push({ role: 'user', content: results });
  }

  return NextResponse.json({
    content: [{ type: 'text', text: finalText }],
    actions, // what the AI actually did, so the UI can refresh/show it
  });
}
