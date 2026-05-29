// app/api/voice/book/route.ts
// ElevenLabs SERVER TOOL — the voice agent calls this to BOOK the slot
// the caller chose. It finds-or-creates the contact, writes the
// appointment, logs activity, and (optionally) enrolls them in a
// follow-up automation. This is the payoff of the voice product.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function authed(req: NextRequest) {
  const s = process.env.VOICE_WEBHOOK_SECRET;
  if (!s) return true;
  return req.headers.get('x-voice-secret') === s;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const { workspace_id: ws, starts_at, name, phone, email, title, duration_min, enroll_automation_id } = body;
  if (!ws || !starts_at) return NextResponse.json({ error: 'workspace_id and starts_at required' }, { status: 400 });

  const admin = createAdmin();

  // find existing contact by phone or email, else create
  let contactId: string | null = null;
  if (phone || email) {
    const { data: found } = await admin.from('contacts').select('id')
      .eq('workspace_id', ws)
      .or([phone ? `phone.eq.${phone}` : '', email ? `email.eq.${email}` : ''].filter(Boolean).join(','))
      .limit(1).maybeSingle();
    contactId = found?.id || null;
  }
  if (!contactId) {
    const [fname, ...rest] = (name || 'Caller').split(' ');
    const { data: c, error } = await admin.from('contacts').insert({
      workspace_id: ws, fname: fname || 'Caller', lname: rest.join(' ') || null,
      phone: phone || null, email: email || null, source: 'other',
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    contactId = c.id;
  }

  // double-booking guard
  const { data: clash } = await admin.from('appointments').select('id')
    .eq('workspace_id', ws).eq('starts_at', new Date(starts_at).toISOString()).limit(1).maybeSingle();
  if (clash) return NextResponse.json({ ok: false, message: 'That time was just taken — please offer another slot.' });

  const { data: appt, error: aerr } = await admin.from('appointments').insert({
    workspace_id: ws, contact_id: contactId,
    title: title || 'Phone booking', starts_at: new Date(starts_at).toISOString(),
    duration_min: duration_min || 30, booked_online: true, status: 'confirmed',
  }).select().single();
  if (aerr) return NextResponse.json({ error: aerr.message }, { status: 500 });

  // activity log
  await admin.from('activity').insert({
    workspace_id: ws, contact_id: contactId, kind: 'appointment.booked',
    text: `Appointment booked by voice agent for ${new Date(starts_at).toLocaleString()}`,
    icon: 'ti-phone',
  });

  // optional: enroll the caller in a follow-up automation
  if (enroll_automation_id) {
    const { data: nodes } = await admin.from('automation_nodes')
      .select('id,is_entry,next_node_id').eq('automation_id', enroll_automation_id);
    const entry = (nodes || []).find((n: any) => n.is_entry);
    const first = entry?.next_node_id;
    if (first) {
      const { data: enr } = await admin.from('enrollments').insert({
        workspace_id: ws, automation_id: enroll_automation_id, contact_id: contactId,
        current_node_id: first, status: 'active',
      }).select('id').single();
      if (enr) await admin.from('automation_runs').insert({
        workspace_id: ws, enrollment_id: enr.id, node_id: first,
        run_at: new Date().toISOString(), status: 'pending',
      });
    }
  }

  const spoken = new Date(starts_at).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return NextResponse.json({
    ok: true, appointment_id: appt.id, contact_id: contactId,
    message: `Booked for ${spoken}. Confirmation is set.`,
  });
}
