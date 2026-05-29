// app/api/ai/score/route.ts — AI lead scoring WITH reasoning.
// POST { contact_id }            → score one contact
// POST { bulk:true, limit:20 }   → score the most recent N unscored-ish contacts
// Writes score back to the contact and returns reason + next action.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace, askClaude, parseJSON } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYS = `You are a B2B sales lead-scoring engine. Given a contact's data, score how hot/qualified the lead is from 0-100 and explain why in one short line, plus the single best next action.
Scoring guidance: engagement signals, fit (company/role), source quality (referral>website>cold), recency, completeness of info. Sparse/cold = low. Strong fit + recent + good source = high.
Return JSON only: {"score":0-100,"reason":"one line","next_action":"one short action"}`;

async function scoreOne(admin: any, ws: string, c: any) {
  const profile = {
    name: `${c.fname} ${c.lname || ''}`.trim(), company: c.company, email: c.email,
    phone: c.phone, source: c.source, tags: c.tags, created_at: c.created_at,
    existing_score: c.score,
  };
  const out = parseJSON(await askClaude(SYS, JSON.stringify(profile), 300),
    { score: c.score || 0, reason: 'n/a', next_action: 'review' });
  const score = Math.max(0, Math.min(100, Number(out.score) || 0));
  await admin.from('contacts').update({ score }).eq('id', c.id).eq('workspace_id', ws);
  return { contact_id: c.id, name: profile.name, score, reason: out.reason, next_action: out.next_action };
}

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }

  try {
    if (body.bulk) {
      const limit = Math.min(Number(body.limit) || 15, 30);
      const { data: contacts } = await admin.from('contacts').select('*')
        .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(limit);
      const results = [];
      for (const c of contacts || []) results.push(await scoreOne(admin, ws, c));
      results.sort((a, b) => b.score - a.score);
      return NextResponse.json({ ok: true, scored: results.length, results });
    }
    if (!body.contact_id) return NextResponse.json({ error: 'contact_id or bulk required' }, { status: 400 });
    const { data: c } = await admin.from('contacts').select('*')
      .eq('id', body.contact_id).eq('workspace_id', ws).single();
    if (!c) return NextResponse.json({ error: 'contact not found' }, { status: 404 });
    return NextResponse.json({ ok: true, result: await scoreOne(admin, ws, c) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
