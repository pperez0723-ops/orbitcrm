// lib/ai.ts — shared helpers for the AI feature endpoints.
import { createClient, createAdmin } from './supabase-server';
import { NextResponse } from 'next/server';

export const AI_MODEL = 'claude-sonnet-4-6';

// Resolve the logged-in user's workspace, or return an error response.
export async function requireWorkspace() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const { data: mem } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!mem?.workspace_id) return { error: NextResponse.json({ error: 'no workspace' }, { status: 400 }) };
  return { workspaceId: mem.workspace_id as string, admin: createAdmin() };
}

// Call Claude (no tools) and return concatenated text.
export async function askClaude(system: string, userContent: string, maxTokens = 1000): Promise<string> {
  const KEY = process.env.CLAUDE_API_KEY;
  if (!KEY) throw new Error('CLAUDE_API_KEY not set');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: AI_MODEL, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'AI error');
  return (d.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}

// Parse JSON out of a model response, tolerating ```json fences.
export function parseJSON<T = any>(text: string, fallback: T): T {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return fallback; }
}
