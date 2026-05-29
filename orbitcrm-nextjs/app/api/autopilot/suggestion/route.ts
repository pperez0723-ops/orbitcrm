// app/api/autopilot/suggestion/route.ts — act on a queued suggestion.
// POST { id, action:'approve'|'dismiss' }
// approve → executes the drafted action (queue email / create task / enroll)
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const { id, action } = body;
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

  const { data: s } = await admin.from('autopilot_suggestions').select('*')
    .eq('id', id).eq('workspace_id', ws).single();
  if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (action === 'dismiss') {
    await admin.from('autopilot_suggestions').update({ status: 'dismissed', acted_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  // approve → execute
  if (s.kind === 'call') {
    await admin.from('tasks').insert({
      workspace_id: ws, contact_id: s.contact_id, priority: 'high',
      title: `🔥 Call (autopilot) — score ${s.score}`, notes: s.summary,
      due_date: new Date().toISOString().slice(0, 10),
    });
  } else if (s.kind === 'email') {
    let convId: string;
    const { data: ex } = await admin.from('conversations').select('id')
      .eq('workspace_id', ws).eq('contact_id', s.contact_id).eq('channel', 'email').maybeSingle();
    if (ex) convId = ex.id;
    else {
      const { data: c } = await admin.from('conversations').insert({
        workspace_id: ws, contact_id: s.contact_id, channel: 'email',
      }).select('id').single();
      convId = c!.id;
    }
    await admin.from('messages').insert({
      workspace_id: ws, conversation_id: convId, contact_id: s.contact_id,
      channel: 'email', direction: 'out', subject: s.draft_subject, body: s.draft_body, status: 'queued',
    });
  }
  await admin.from('autopilot_suggestions').update({ status: 'approved', acted_at: new Date().toISOString() }).eq('id', id);
  await admin.from('activity').insert({
    workspace_id: ws, contact_id: s.contact_id, kind: 'autopilot',
    text: `Autopilot suggestion approved: ${s.kind}`, icon: 'ti-robot',
  });
  return NextResponse.json({ ok: true, status: 'approved' });
}
