'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MODES = [
  { v: 'off', label: 'Off', desc: 'Autopilot disabled' },
  { v: 'suggest', label: 'Suggest', desc: 'AI drafts & queues for your approval' },
  { v: 'auto', label: 'Full Auto', desc: 'AI acts on its own (with guardrails)' },
];

export default function AutopilotClient({ initialSettings, initialSuggestions, automations }: any) {
  const router = useRouter();
  const [mode, setMode] = useState(initialSettings?.mode || 'off');
  const [hot, setHot] = useState(initialSettings?.hot_threshold ?? 70);
  const [cold, setCold] = useState(initialSettings?.cold_threshold ?? 35);
  const [dnd, setDnd] = useState(initialSettings?.respect_dnd ?? true);
  const [nurture, setNurture] = useState(initialSettings?.nurture_automation_id || '');
  const [sugg, setSugg] = useState<any[]>(initialSuggestions);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');

  async function saveSettings(next?: Partial<any>) {
    const payload = { mode, hot_threshold: hot, cold_threshold: cold, respect_dnd: dnd, nurture_automation_id: nurture || null, ...next };
    await fetch('/api/autopilot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  async function runNow() {
    setRunning(true); setMsg('');
    try {
      const r = await fetch('/api/autopilot/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 10 }) });
      const d = await r.json();
      if (d.error) setMsg(d.error);
      else { setMsg(`Processed ${d.processed} contact(s) in ${d.mode} mode.`); router.refresh(); }
    } catch { setMsg('Run failed'); } finally { setRunning(false); }
  }

  async function act(id: string, action: 'approve' | 'dismiss') {
    setSugg((s) => s.filter((x) => x.id !== id));
    await fetch('/api/autopilot/suggestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    router.refresh();
  }

  const sc = (s: number) => s >= 70 ? 'var(--teal)' : s >= 40 ? 'var(--gold)' : 'var(--text-sec)';
  const kindIcon: Record<string, string> = { call: '📞', email: '✉️', sms: '💬', nurture: '🌱' };

  return (
    <>
      <div className="top">
        <div className="top-title">🤖 Autopilot</div>
        <button className="btn" onClick={runNow} disabled={running || mode === 'off'}>
          {running ? <span className="spinner" /> : <><i className="ti ti-player-play" /> Run Now</>}
        </button>
      </div>
      <div className="content">
        {/* Mode selector */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>How Autopilot works</div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 14, lineHeight: 1.6 }}>
            On every new lead (and a daily sweep), AI scores them, writes a brief, drafts outreach, and decides the play:
            hot → call task, warm → email, cold → nurture. Something GHL simply doesn't do.
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {MODES.map((m) => (
              <div key={m.v} onClick={() => { setMode(m.v); saveSettings({ mode: m.v }); }}
                style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `1px solid ${mode === m.v ? 'var(--red)' : 'var(--border-dim)'}`, background: mode === m.v ? 'var(--red-dim)' : 'var(--black4)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: mode === m.v ? 'var(--red)' : 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{m.desc}</div>
              </div>
            ))}
          </div>
          <div className="frow">
            <div className="fg"><label>Hot threshold (≥ = call)</label>
              <input type="number" value={hot} onChange={(e) => setHot(+e.target.value)} onBlur={() => saveSettings()} /></div>
            <div className="fg"><label>Cold threshold (≤ = nurture)</label>
              <input type="number" value={cold} onChange={(e) => setCold(+e.target.value)} onBlur={() => saveSettings()} /></div>
            <div className="fg"><label>Nurture automation</label>
              <select value={nurture} onChange={(e) => { setNurture(e.target.value); saveSettings({ nurture_automation_id: e.target.value || null }); }}>
                <option value="">— none —</option>
                {automations.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-sec)', marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={dnd} onChange={(e) => { setDnd(e.target.checked); saveSettings({ respect_dnd: e.target.checked }); }} />
            Respect Do-Not-Disturb (never auto-contact opted-out leads)
          </label>
          {saved && <span style={{ fontSize: 11, color: 'var(--teal)', marginLeft: 8 }}>✓ saved</span>}
          {msg && <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 10 }}>{msg}</div>}
        </div>

        {/* Suggestion queue */}
        <div className="panel">
          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Pending suggestions {sugg.length > 0 && <span style={{ color: 'var(--red)' }}>({sugg.length})</span>}
          </div>
          {sugg.length === 0 && <div className="empty">No pending suggestions. Run Autopilot or add leads.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sugg.map((s) => (
              <div key={s.id} style={{ padding: 14, background: 'var(--black4)', borderRadius: 10, border: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{kindIcon[s.kind] || '•'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {s.contacts?.fname} {s.contacts?.lname || ''} {s.contacts?.company && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {s.contacts.company}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.reason}</div>
                  </div>
                  <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: sc(s.score) }}>{s.score}</span>
                  <span className="tag" style={{ background: 'var(--black5)', color: 'var(--text-sec)', textTransform: 'uppercase' }}>{s.kind}</span>
                </div>
                {s.summary && <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 6 }}>{s.summary}</div>}
                {s.draft_body && (
                  <div style={{ fontSize: 12, background: 'var(--black2)', borderRadius: 8, padding: 10, marginBottom: 10, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {s.draft_subject && <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.draft_subject}</div>}
                    {s.draft_body}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => act(s.id, 'dismiss')}>Dismiss</button>
                  <button className="btn-save" onClick={() => act(s.id, 'approve')}>Approve &amp; Do It</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
