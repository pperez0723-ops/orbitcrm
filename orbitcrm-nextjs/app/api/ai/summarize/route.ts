// app/api/ai/summarize/route.ts — AI reads a contact's full history
// (notes, deals, messages, activity) and writes a tight brief + next step.
// POST { contact_id }
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, askClaude, parseJSON } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }
  if (!body.contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
  const id = body.contact_id;

  const [{ data: contact }, { data: notes }, { data: deals }, { data: activity }, { data: msgs }] =
    await Promise.all([
      admin.from('contacts').select('*').eq('id', id).eq('workspace_id', ws).single(),
      admin.from('notes').select('body,created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
      admin.from('deals').select('title,value,stage_id,last_activity_at').eq('contact_id', id),
      admin.from('activity').select('kind,text,created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(15),
      admin.from('messages').select('direction,body,created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
  if (!contact) return NextResponse.json({ error: 'contact not found' }, { status: 404 });

  const dossier = {
    contact: { name: `${contact.fname} ${contact.lname || ''}`.trim(), company: contact.company, source: contact.source, score: contact.score, tags: contact.tags },
    deals, notes, recent_activity: activity, recent_messages: msgs,
  };

  const sys = `You are a sales assistant. Summarize this contact for a rep about to engage them. Be specific and brief. Return JSON only: {"summary":"2-3 sentences","status":"one phrase e.g. 'warm, awaiting proposal'","next_step":"one concrete action"}`;

  try {
    const out = parseJSON(await askClaude(sys, JSON.stringify(dossier), 600),
      { summary: '', status: '', next_step: '' });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
