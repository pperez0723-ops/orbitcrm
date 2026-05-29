// app/api/voice/post-call/route.ts
// ElevenLabs POST-CALL webhook. Fires after a call ends with the full
// transcript + analysis. We log it to the contact's timeline and store
// the conversation. Lets the CRM keep a record of every voice interaction.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ElevenLabs can sign these; for now accept + optionally check secret
  const s = process.env.VOICE_WEBHOOK_SECRET;
  if (s && req.headers.get('x-voice-secret') !== s) {
    // ElevenLabs uses HMAC; if you enable that, verify here instead.
  }
  let body: any; try { body = await req.json(); } catch { body = {}; }

  // ElevenLabs post_call_transcription shape (fields vary by version)
  const ws = body.workspace_id || body.metadata?.workspace_id;
  const transcript = body.transcript || body.data?.transcript || body.analysis?.transcript;
  const phone = body.caller_id || body.metadata?.caller_id || body.customer_phone;
  const summary = body.analysis?.summary || body.summary || '';

  if (!ws) return NextResponse.json({ ok: true, note: 'no workspace_id in payload; configure it in the agent metadata' });

  const admin = createAdmin();

  // find the contact by phone if we can
  let contactId: string | null = null;
  if (phone) {
    const { data } = await admin.from('contacts').select('id')
      .eq('workspace_id', ws).eq('phone', phone).limit(1).maybeSingle();
    contactId = data?.id || null;
  }

  const textBlob = typeof transcript === 'string'
    ? transcript
    : Array.isArray(transcript)
      ? transcript.map((t: any) => `${t.role || t.speaker}: ${t.message || t.text}`).join('\n')
      : JSON.stringify(transcript || {});

  await admin.from('activity').insert({
    workspace_id: ws, contact_id: contactId, kind: 'call.completed',
    text: summary ? `Voice call: ${summary}` : 'Voice call completed',
    icon: 'ti-phone', meta: { transcript: textBlob.slice(0, 5000) },
  });

  return NextResponse.json({ ok: true, logged: true, contact_id: contactId });
}
