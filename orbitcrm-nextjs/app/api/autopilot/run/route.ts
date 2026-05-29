// app/api/autopilot/run/route.ts — manual "Run Autopilot now" trigger.
// Processes recent contacts through the autopilot chain. Respects the
// workspace's mode + daily action cap.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/ai';
import { runAutopilotForContact, getSettings, actionsToday } from '@/lib/autopilot';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }

  const settings = await getSettings(admin, ws);
  if (settings.mode === 'off') {
    return NextResponse.json({ error: 'Autopilot is off. Enable it in settings first.' }, { status: 400 });
  }

  // pick targets: a specific contact, or the most recent N
  let contacts: any[] = [];
  if (body.contact_id) {
    const { data } = await admin.from('contacts').select('*').eq('id', body.contact_id).eq('workspace_id', ws).single();
    if (data) contacts = [data];
  } else {
    const limit = Math.min(Number(body.limit) || 10, 25);
    const { data } = await admin.from('contacts').select('*')
      .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(limit);
    contacts = data || [];
  }

  const already = await actionsToday(admin, ws);
  let budget = Math.max(0, settings.max_actions_day - already);
  const results = [];
  try {
    for (const c of contacts) {
      if (budget <= 0) break;
      const r = await runAutopilotForContact(admin, ws, c, settings);
      if (r.acted) { budget--; results.push({ contact: `${c.fname} ${c.lname || ''}`.trim(), ...r }); }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message, partial: results }, { status: 502 });
  }
  return NextResponse.json({ ok: true, mode: settings.mode, processed: results.length, results });
}
