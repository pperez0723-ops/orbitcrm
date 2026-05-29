// app/api/webhooks/resend/route.ts — INBOUND email replies (Resend inbound,
// or any forwarding service that POSTs JSON). Matches sender to a contact,
// appends to the email conversation.
// Configure: point your inbound-email route to
// https://YOURAPP.vercel.app/api/webhooks/resend?ws=WORKSPACE_ID
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ws = req.nextUrl.searchParams.get('ws');
  let payload: any; try { payload = await req.json(); } catch { payload = {}; }
  // tolerate different inbound shapes
  const from = payload.from || payload.sender || payload.envelope?.from || payload.data?.from;
  const subject = payload.subject || payload.data?.subject || '';
  const text = payload.text || payload.body || payload.data?.text || payload['body-plain'] || '';
  const fromEmail = typeof from === 'string' ? from.replace(/.*<(.+)>.*/, '$1').trim() : from?.email;
  if (!ws || !fromEmail) return NextResponse.json({ ok: true, skipped: true });

  const admin = createAdmin();
  let contactId: string | null = null;
  const { data: found } = await admin.from('contacts').select('id').eq('workspace_id', ws).eq('email', fromEmail).limit(1).maybeSingle();
  contactId = found?.id || null;
  if (!contactId) {
    const { data: c } = await admin.from('contacts').insert({
      workspace_id: ws, fname: 'Email', lname: fromEmail, email: fromEmail, source: 'other',
    }).select('id').single();
    contactId = c!.id;
  }

  let convId: string;
  const { data: ex } = await admin.from('conversations').select('id')
    .eq('workspace_id', ws).eq('contact_id', contactId).eq('channel', 'email').maybeSingle();
  if (ex) convId = ex.id;
  else {
    const { data: nc } = await admin.from('conversations').insert({ workspace_id: ws, contact_id: contactId, channel: 'email' }).select('id').single();
    convId = nc!.id;
  }
  await admin.from('messages').insert({
    workspace_id: ws, conversation_id: convId, contact_id: contactId,
    channel: 'email', direction: 'in', subject, body: text, status: 'received',
  });
  return NextResponse.json({ ok: true });
}
