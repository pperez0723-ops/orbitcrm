// app/api/autopilot/settings/route.ts — read/save autopilot settings.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  let body: any; try { body = await req.json(); } catch { body = {}; }

  const row: any = { workspace_id: ws, updated_at: new Date().toISOString() };
  for (const k of ['mode', 'run_on_new', 'daily_sweep', 'respect_dnd', 'max_actions_day', 'hot_threshold', 'cold_threshold', 'nurture_automation_id']) {
    if (k in body) row[k] = body[k];
  }
  const { error } = await admin.from('autopilot_settings').upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
