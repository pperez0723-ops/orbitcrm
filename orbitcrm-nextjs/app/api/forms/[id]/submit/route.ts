// app/api/forms/[id]/submit/route.ts — PUBLIC endpoint (no auth).
// A hosted form (or external site) POSTs submissions here. We create/update
// the contact, store the submission, and optionally enroll in an automation.
// This is what makes forms REAL (the HTML demo only faked it).
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() { return new NextResponse('ok', { headers: CORS }); }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdmin();
  const formId = params.id;
  let data: any; try { data = await req.json(); } catch { data = {}; }

  const { data: form } = await admin.from('forms').select('*').eq('id', formId).single();
  if (!form || !form.active) {
    return NextResponse.json({ error: 'form not found' }, { status: 404, headers: CORS });
  }
  const ws = form.workspace_id;

  // map common fields
  const email = data.email || data.Email;
  const phone = data.phone || data.Phone;
  const fname = data.fname || data.first_name || data.name?.split(' ')[0] || 'Lead';
  const lname = data.lname || data.last_name || (data.name?.split(' ').slice(1).join(' ')) || null;

  // find-or-create contact
  let contactId: string | null = null;
  if (email || phone) {
    const { data: found } = await admin.from('contacts').select('id').eq('workspace_id', ws)
      .or([email ? `email.eq.${email}` : '', phone ? `phone.eq.${phone}` : ''].filter(Boolean).join(','))
      .limit(1).maybeSingle();
    contactId = found?.id || null;
  }
  if (!contactId) {
    const { data: c } = await admin.from('contacts').insert({
      workspace_id: ws, fname, lname, email: email || null, phone: phone || null,
      company: data.company || null, source: 'form',
    }).select('id').single();
    contactId = c!.id;
  }

  // store submission + bump counter
  await admin.from('form_submissions').insert({ workspace_id: ws, form_id: formId, contact_id: contactId, data });
  await admin.from('forms').update({ submissions: (form.submissions || 0) + 1 }).eq('id', formId);
  await admin.from('activity').insert({
    workspace_id: ws, contact_id: contactId, kind: 'form.submitted',
    text: `Submitted form: ${form.name}`, icon: 'ti-forms',
  });

  // optional auto-enroll
  if (form.enroll_automation_id) {
    const { data: nodes } = await admin.from('automation_nodes').select('id,is_entry,next_node_id').eq('automation_id', form.enroll_automation_id);
    const entry = (nodes || []).find((n: any) => n.is_entry);
    const first = entry?.next_node_id;
    if (first) {
      const { data: enr } = await admin.from('enrollments').insert({
        workspace_id: ws, automation_id: form.enroll_automation_id, contact_id: contactId, current_node_id: first, status: 'active',
      }).select('id').single();
      if (enr) await admin.from('automation_runs').insert({
        workspace_id: ws, enrollment_id: enr.id, node_id: first, run_at: new Date().toISOString(), status: 'pending',
      });
    }
  }

  // fire contact_created automations + execute instant steps NOW (welcome SMS)
  if (contactId) {
    try {
      const { enrollContactInTrigger, processContactRunsNow } = await import('@/lib/engine');
      await enrollContactInTrigger(admin, ws, contactId, 'contact_created');
      await processContactRunsNow(admin, ws, contactId);
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, redirect: form.redirect_url || null }, { headers: CORS });
}
