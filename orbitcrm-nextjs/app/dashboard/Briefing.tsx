'use client';
import { useState } from 'react';

type Priority = { action: string; why: string; urgency: 'high' | 'medium' | 'low' };
type Briefing = { headline: string; priorities: Priority[]; wins: string[]; risks: string[] };

const URG: Record<string, string> = { high: 'var(--red)', medium: 'var(--gold)', low: 'var(--teal)' };

export default function Briefing() {
  const [b, setB] = useState<Briefing | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/ai/briefing');
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setB(d.briefing);
    } catch (e: any) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel" style={{ marginBottom: 16, borderColor: 'rgba(232,48,58,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: b ? 14 : 0 }}>
        <div style={{ fontSize: 18 }}>🛰️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 15, fontWeight: 600, letterSpacing: .5 }}>
            AI Mission Briefing
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            What GHL can't do — your CRM tells you what to do today.
          </div>
        </div>
        <button className="btn" onClick={run} disabled={busy}>
          {busy ? <span className="spinner" /> : <><i className="ti ti-sparkles" /> {b ? 'Refresh' : 'Generate'}</>}
        </button>
      </div>

      {err && <div className="auth-error">{err}</div>}

      {b && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>
            {b.headline}
          </div>

          {b.priorities?.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>
                Today's priorities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {b.priorities.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--black4)', borderRadius: 9, borderLeft: `3px solid ${URG[p.urgency] || 'var(--text-dim)'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.action}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-sec)', marginTop: 2 }}>{p.why}</div>
                    </div>
                    <span className="tag" style={{ background: 'transparent', color: URG[p.urgency], border: `1px solid ${URG[p.urgency]}`, height: 'fit-content' }}>
                      {p.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {b.wins?.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--teal)', marginBottom: 6 }}>✓ Wins</div>
                {b.wins.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 4 }}>• {w}</div>)}
              </div>
            )}
            {b.risks?.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--red)', marginBottom: 6 }}>⚠ Risks</div>
                {b.risks.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 4 }}>• {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
