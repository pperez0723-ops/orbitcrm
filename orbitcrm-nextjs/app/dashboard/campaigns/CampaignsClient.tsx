'use client';
import { useState } from 'react';

export default function CampaignsClient({ initial }: { initial: any[] }) {
  const [camps, setCamps] = useState<any[]>(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', channel: 'email', subject: '', message: '', tag: '' });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState('');

  async function aiWrite() {
    setAiBusy(true);
    try {
      const r = await fetch('/api/ai/compose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: f.channel, instruction: f.name || 'a marketing campaign message' }),
      });
      const d = await r.json();
      if (d.body) setF((x) => ({ ...x, subject: d.subject || x.subject, message: d.body }));
    } catch { /* noop */ } finally { setAiBusy(false); }
  }

  async function send() {
    if (!f.message.trim()) return;
    setBusy(true); setResult('');
    try {
      const r = await fetch('/api/campaigns/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const d = await r.json();
      if (d.error) setResult(d.error);
      else { setResult(`Queued to ${d.queued} recipient(s).`); setOpen(false); setF({ name: '', channel: 'email', subject: '', message: '', tag: '' }); }
    } catch { setResult('Send failed'); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="top">
        <div className="top-title">Campaigns</div>
        <button className="btn" onClick={() => setOpen(true)}><i className="ti ti-plus" /> New Campaign</button>
      </div>
      <div className="content">
        {result && <div style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 12 }}>{result}</div>}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th>Name</th><th>Channel</th><th>Status</th><th>Recipients</th><th>Sent</th></tr></thead>
            <tbody>
              {camps.length === 0 && <tr><td colSpan={5} className="empty">No campaigns yet. Blast email/SMS to a tag segment — AI can write it for you.</td></tr>}
              {camps.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><span className="tag" style={{ background: 'var(--black5)', color: 'var(--text-dim)' }}>{c.channel}</span></td>
                  <td style={{ color: 'var(--text-sec)' }}>{c.status}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{c.recipients}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{c.sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>New Campaign</h2>
            <div className="frow">
              <div className="fg"><label>Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="fg"><label>Channel</label>
                <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
                  <option value="email">Email</option><option value="sms">SMS</option>
                </select></div>
            </div>
            <div className="fg" style={{ marginBottom: 12 }}><label>Audience tag (blank = everyone)</label><input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="e.g. newsletter" /></div>
            {f.channel === 'email' && <div className="fg" style={{ marginBottom: 12 }}><label>Subject</label><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>}
            <div className="fg" style={{ marginBottom: 8 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>Message
                <span style={{ cursor: 'pointer', color: 'var(--teal)' }} onClick={aiWrite}>{aiBusy ? '…' : '✨ AI write'}</span>
              </label>
              <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} style={{ minHeight: 100, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 10, color: 'var(--text)', fontSize: 12.5 }} />
            </div>
            <div className="mfoot">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-save" onClick={send} disabled={busy || !f.message.trim()}>{busy ? 'Sending…' : 'Send Campaign'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
