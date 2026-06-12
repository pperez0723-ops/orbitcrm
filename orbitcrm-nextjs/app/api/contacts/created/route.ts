// app/api/contacts/created/route.ts
// Fired by the UI immediately after a contact is added. Enrolls the contact
// into all active "contact_created" automations and executes the instant
// steps NOW (welcome SMS / email) — no waiting for the daily cron.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase-server';
import { enrollContactInTrigger, processContactRunsNow } from '@/lib/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: mem } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const ws = mem?.workspace_id;
  if (!ws) return NextResponse.json({ error: 'no workspace' }, { status: 400 });

  let contactId = '';
  try { contactId = (await req.json()).contact_id || ''; } catch {}
  if (!contactId) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });

  const admin = createAdmin();

  // verify the contact belongs to this workspace
  const { data: contact } = await admin.from('contacts')
    .select('id').eq('id', contactId).eq('workspace_id', ws).maybeSingle();
  if (!contact) return NextResponse.json({ error: 'contact not found' }, { status: 404 });

  const enrolled = await enrollContactInTrigger(admin, ws, contactId, 'contact_created');
  const { executed, errors } = await processContactRunsNow(admin, ws, contactId);

  return NextResponse.json({ ok: true, enrolled: enrolled.length, executed, errors });
}
