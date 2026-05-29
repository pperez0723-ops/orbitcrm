// app/api/webhooks/twilio/route.ts — INBOUND SMS from Twilio.
// Twilio POSTs form-encoded data when someone texts your number. We match
// the sender to a contact (by phone), create/append the conversation, and
// store the inbound message. THIS is what makes the inbox truly 2-way.
//
// Configure in Twilio: set the number's messaging webhook to
// https://YOURAPP.vercel.app/api/webhooks/twilio?ws=WORKSPACE_ID
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ws = req.nextUrl.searchParams.get('ws');
  const form = await req.formData();
  const from = String(form.get('From') || '');
  const body = String(form.get('Body') || '');
  if (!ws || !from) return twiml();

  const admin = createAdmin();

  // match or create contact by phone
  let contactId: string | null = null;
  const { data: found } = await admin.from('contacts').select('id').eq('workspace_id', ws).eq('phone', from).limit(1).maybeSingle();
  contactId = found?.id || null;
  if (!contactId) {
    const { data: c } = await admin.from('contacts').insert({
      workspace_id: ws, fname: 'SMS', lname: from, phone: from, source: 'other',
    }).select('id').single();
    contactId = c!.id;
  }

  // conversation
  let convId: string;
  const { data: ex } = await admin.from('conversations').select('id')
    .eq('workspace_id', ws).eq('contact_id', contactId).eq('channel', 'sms').maybeSingle();
  if (ex) convId = ex.id;
  else {
    const { data: nc } = await admin.from('conversations').insert({ workspace_id: ws, contact_id: contactId, channel: 'sms' }).select('id').single();
    convId = nc!.id;
  }

  // store inbound message (the on_new_message trigger bumps unread_count)
  await admin.from('messages').insert({
    workspace_id: ws, conversation_id: convId, contact_id: contactId,
    channel: 'sms', direction: 'in', body, status: 'received',
  });
  await admin.from('activity').insert({
    workspace_id: ws, contact_id: contactId, kind: 'message.received', text: `SMS: ${body.slice(0, 80)}`, icon: 'ti-message',
  });

  return twiml();
}

// Twilio expects valid TwiML (empty = no auto-reply).
function twiml() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}
