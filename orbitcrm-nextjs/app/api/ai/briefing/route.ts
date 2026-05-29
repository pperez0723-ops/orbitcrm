// app/api/ai/briefing/route.ts — the "Mission Briefing" GHL has no answer for.
// Pulls the real workspace state, asks Claude to produce a prioritized,
// actionable morning briefing. Read-only (no tools), fast.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const KEY = process.env.CLAUDE_API_KEY;
  if (!KEY) return NextResponse.json({ error: 'CLAUDE_API_KEY not set' }, { status: 500 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: mem } = await supabase.from('workspace_members')
    .select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const ws = mem?.workspace_id;
  if (!ws) return NextResponse.json({ error: 'no workspace' }, { status: 400 });

  const admin = createAdmin();
  const now = Date.now();

  const [{ data: contacts }, { data: deals }, { data: stages }, { data: tasks }, { data: appts }] =
    await Promise.all([
      admin.from('contacts').select('id,fname,lname,company,score,source,created_at').eq('workspace_id', ws),
      admin.from('deals').select('title,value,stage_id,last_activity_at').eq('workspace_id', ws),
      admin.from('stages').select('id,name').eq('workspace_id', ws),
      admin.from('tasks').select('title,due_date,priority,done').eq('workspace_id', ws).eq('done', false),
      admin.from('appointments').select('title,starts_at').eq('workspace_id', ws).gte('starts_at', new Date().toISOString()).limit(10),
    ]);

  const stageName = (id: string) => (stages || []).find((s: any) => s.id === id)?.name || '?';
  const rotting = (deals || []).filter((d: any) =>
    d.last_activity_at && (now - new Date(d.last_activity_at).getTime()) > 7 * 86400e3);
  const newContacts = (contacts || []).filter((c: any) =>
    c.created_at && (now - new Date(c.created_at).getTime()) < 2 * 86400e3);

  const snapshot = {
    totalContacts: contacts?.length || 0,
    newLast48h: newContacts.length,
    pipelineValue: (deals || []).reduce((a: number, d: any) => a + Number(d.value || 0), 0),
    dealsByStage: (stages || []).map((s: any) => ({
      stage: s.name, count: (deals || []).filter((d: any) => d.stage_id === s.id).length,
    })),
    rottingDeals: rotting.map((d: any) => ({ title: d.title, value: d.value, stage: stageName(d.stage_id) })),
    openTasks: (tasks || []).map((t: any) => ({ title: t.title, due: t.due_date, priority: t.priority })),
    upcomingAppts: (appts || []).map((a: any) => ({ title: a.title, at: a.starts_at })),
    topLeads: (contacts || []).sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 5)
      .map((c: any) => ({ name: `${c.fname} ${c.lname || ''}`.trim(), company: c.company, score: c.score })),
  };

  const sys = `You are OrbitAI Mission Control. Produce a concise morning briefing for a sales operator.
Return JSON only, no prose, with this exact shape:
{"headline":"one punchy sentence on the state of things",
 "priorities":[{"action":"what to do","why":"one line reason","urgency":"high|medium|low"}],
 "wins":["good things worth noting"],
 "risks":["things slipping"]}
Max 5 priorities. Be specific and reference real names/numbers from the data. If data is sparse, say so and suggest what to add.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1000, system: sys,
      messages: [{ role: 'user', content: `Workspace data:\n${JSON.stringify(snapshot)}` }],
    }),
  });
  const data = await r.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 502 });

  let briefing: any = null;
  try {
    const txt = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    briefing = JSON.parse(txt.replace(/```json|```/g, '').trim());
  } catch {
    briefing = { headline: 'Briefing unavailable', priorities: [], wins: [], risks: [] };
  }
  return NextResponse.json({ briefing, snapshot });
}
