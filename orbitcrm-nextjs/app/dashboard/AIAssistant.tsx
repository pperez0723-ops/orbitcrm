'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Msg = { role: 'user' | 'assistant'; text: string; actions?: any[] };

export default function AIAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const history = [...msgs, { role: 'user' as const, text }];
    setMsgs(history);
    setBusy(true);
    try {
      const r = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are OrbitAI, the operator assistant inside OrbitCRM. You can take real actions using your tools (create contacts, deals, tasks, automations; search; pipeline summary). When the user asks you to create or change something, DO IT with the tools, then confirm what you did in one short sentence. Be concise.`,
          messages: history.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const d = await r.json();
      const reply = d.content?.[0]?.text || d.error || 'Done.';
      setMsgs([...history, { role: 'assistant', text: reply, actions: d.actions }]);
      // if the AI changed data, refresh server components
      if (d.actions?.some((a: any) => a.result?.ok)) router.refresh();
    } catch {
      setMsgs([...history, { role: 'assistant', text: 'Connection error.' }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="OrbitAI"
        style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 90, width: 52, height: 52, borderRadius: '50%', background: 'var(--red)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, boxShadow: '0 0 24px rgba(232,48,58,0.5)' }}>
        <i className="ti ti-sparkles" />
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 90, width: 360, maxWidth: '92vw', height: 480, maxHeight: '80vh', background: 'rgba(12,12,20,0.98)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="ti ti-sparkles" style={{ color: 'var(--red)' }} />
        <div style={{ flex: 1, fontFamily: 'Rajdhani', fontWeight: 600 }}>OrbitAI</div>
        <i className="ti ti-x" style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setOpen(false)} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Try: <br />• "Add a contact: Maria Lopez, maria@acme.com"<br />• "Create a 3-day follow-up automation for new leads"<br />• "Summarize my pipeline"<br />• "Make a high-priority task to call John tomorrow"
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ padding: '9px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, background: m.role === 'user' ? 'var(--red)' : 'var(--black4)', color: m.role === 'user' ? '#fff' : 'var(--text)' }}>
              {m.text}
            </div>
            {m.actions?.filter((a: any) => a.result?.ok).map((a: any, j: number) => (
              <div key={j} style={{ fontSize: 10.5, color: 'var(--teal)', marginTop: 4 }}>
                ✓ {a.tool.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        ))}
        {busy && <div className="spinner" />}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--border-dim)', display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Tell OrbitAI what to do…"
          style={{ flex: 1, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 9, padding: '9px 12px', color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
        <button className="btn-save" onClick={send} disabled={busy} style={{ height: 'auto', padding: '0 14px' }}>
          <i className="ti ti-send" />
        </button>
      </div>
    </div>
  );
}
