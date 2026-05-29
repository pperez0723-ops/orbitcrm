// app/api/voice/check-availability/route.ts
// ElevenLabs SERVER TOOL — the voice agent calls this mid-call to find
// open appointment slots. Auth via a shared secret (VOICE_WEBHOOK_SECRET)
// + a workspace_id passed by the agent (configured per client agent).
//
// Returns simple, speakable slots the agent can offer the caller.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function authed(req: NextRequest) {
  const s = process.env.VOICE_WEBHOOK_SECRET;
  if (!s) return true; // if unset, allow (dev). Set it in prod.
  return req.headers.get('x-voice-secret') === s;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: any; try { body = await req.json(); } catch { body = {}; }
  const ws = body.workspace_id;
  const days = Math.min(Number(body.days) || 5, 14);
  if (!ws) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const admin = createAdmin();

  // availability windows (weekday + minute ranges) for this workspace
  const { data: windows } = await admin.from('availability').select('*').eq('workspace_id', ws);
  // existing appts to avoid double-booking
  const from = new Date();
  const to = new Date(Date.now() + days * 86400e3);
  const { data: booked } = await admin.from('appointments').select('starts_at,duration_min')
    .eq('workspace_id', ws).gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString());

  // Default window if none configured: Mon–Fri 9:00–17:00, 30-min slots.
  const wins = (windows && windows.length) ? windows : Array.from({ length: 5 }, (_, i) => ({
    weekday: i + 1, start_min: 540, end_min: 1020, slot_min: 30, buffer_min: 0,
  }));

  const taken = new Set((booked || []).map((b: any) => new Date(b.starts_at).getTime()));
  const slots: string[] = [];
  for (let d = 0; d < days && slots.length < 6; d++) {
    const day = new Date(from.getTime() + d * 86400e3);
    const wd = day.getDay();
    const todays = wins.filter((w: any) => w.weekday === wd);
    for (const w of todays) {
      for (let m = w.start_min; m + (w.slot_min || 30) <= w.end_min && slots.length < 6; m += (w.slot_min || 30) + (w.buffer_min || 0)) {
        const slot = new Date(day); slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
        if (slot.getTime() <= Date.now()) continue;
        if (taken.has(slot.getTime())) continue;
        slots.push(slot.toISOString());
      }
    }
  }

  // speakable summary for the agent
  const spoken = slots.slice(0, 4).map((iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  });

  return NextResponse.json({
    ok: true,
    available_slots: slots,
    spoken_options: spoken,
    message: spoken.length
      ? `Available times: ${spoken.join(', ')}`
      : 'No open slots in the requested window.',
  });
}
