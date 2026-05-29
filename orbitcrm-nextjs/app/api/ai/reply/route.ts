// app/api/ai/reply/route.ts — AI drafts a reply in a conversation.
// POST { conversation_id }  → reads the thread, drafts the next reply.
// Powers the inbox "Suggest reply" button (works once inbox UI lands).
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, askClaude, parseJSON } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }
  if (!body.conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });

  const { data: convo } = await admin.from('conversations').select('*,contacts(*)')
    .eq('id', body.conversation_id).eq('workspace_id', ws).single();
  if (!convo) return NextResponse.json({ error: 'conversation not found' }, { status: 404 });

  const { data: messages } = await admin.from('messages')
    .select('direction,body,created_at').eq('conversation_id', body.conversation_id)
    .order('created_at', { ascending: true }).limit(30);

  const thread = (messages || []).map((m: any) =>
    `${m.direction === 'in' ? 'CUSTOMER' : 'US'}: ${m.body}`).join('\n');
  const channel = convo.channel;

  const sys = `You are drafting the next reply FROM the business TO the customer in a ${channel} conversation. Be helpful, warm, concise, and move the conversation toward a booking or sale where natural. ${channel === 'sms' ? 'Keep it short (SMS).' : ''} Return JSON only: {"reply":"..."}`;

  try {
    const out = parseJSON(await askClaude(sys, `Conversation so far:\n${thread || '(no messages yet)'}`, 500), { reply: '' });
    return NextResponse.json({ ok: true, reply: out.reply, channel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
