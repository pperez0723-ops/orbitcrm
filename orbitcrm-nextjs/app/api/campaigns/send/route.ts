// app/api/campaigns/send/route.ts — queue a bulk blast to a segment.
// Creates message rows (status 'queued'); the worker dispatches them via
// the workspace's Twilio/Resend creds. Respects DND.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const { name, channel = 'email', subject, message, tag } = body;
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

  // build audience
  let q = admin.from('contacts').select('*').eq('workspace_id', ws);
  if (tag) q = q.contains('tags', [tag]);
  const { data: contacts } = await q;
  const audience = (contacts || []).filter((c: any) =>
    channel === 'email' ? (c.email && !c.dnd_email) : (c.phone && !c.dnd_sms));

  // create campaign record
  const { data: camp } = await admin.from('campaigns').insert({
    workspace_id: ws, name: name || 'Campaign', channel, subject, body: message,
    status: 'sending', recipients: audience.length,
  }).select().single();

  // queue a message per recipient (ensure conversation)
  let queued = 0;
  for (const c of audience) {
    let convId: string;
    const { data: ex } = await admin.from('conversations').select('id')
      .eq('workspace_id', ws).eq('contact_id', c.id).eq('channel', channel).maybeSingle();
    if (ex) convId = ex.id;
    else {
      const { data: nc } = await admin.from('conversations').insert({ workspace_id: ws, contact_id: c.id, channel }).select('id').single();
      convId = nc!.id;
    }
    await admin.from('messages').insert({
      workspace_id: ws, conversation_id: convId, contact_id: c.id, channel,
      direction: 'out', subject: subject || null, body: message, status: 'queued',
    });
    queued++;
  }
  await admin.from('campaigns').update({ status: 'sent', sent: queued }).eq('id', camp.id);
  return NextResponse.json({ ok: true, queued, audience: audience.length });
}
