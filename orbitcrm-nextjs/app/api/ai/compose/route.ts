// app/api/ai/compose/route.ts — AI writes an email or SMS for a contact.
// POST { contact_id?, channel:'email'|'sms', instruction, tone? }
// Returns subject (email) + body with the contact's real details filled in.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, askClaude, parseJSON } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const { contact_id, channel = 'email', instruction, tone } = body;
  if (!instruction) return NextResponse.json({ error: 'instruction required' }, { status: 400 });

  let contact: any = null;
  if (contact_id) {
    const { data } = await admin.from('contacts').select('*')
      .eq('id', contact_id).eq('workspace_id', ws).single();
    contact = data;
  }

  const sys = channel === 'sms'
    ? `You write concise, friendly SMS messages for a salesperson. Keep under 160 chars, no subject, natural and human. ${tone ? 'Tone: ' + tone + '.' : ''} Return JSON only: {"body":"..."}`
    : `You write effective sales emails. Professional but warm, concise, clear CTA. ${tone ? 'Tone: ' + tone + '.' : ''} Use the contact's real name/company. Return JSON only: {"subject":"...","body":"..."}`;

  const ctx = {
    instruction,
    contact: contact ? {
      name: `${contact.fname} ${contact.lname || ''}`.trim(),
      company: contact.company, email: contact.email,
    } : null,
  };

  try {
    const out = parseJSON(await askClaude(sys, JSON.stringify(ctx), 700), { subject: '', body: '' });
    return NextResponse.json({ ok: true, channel, ...out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
