'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Contact = {
  id: string; fname: string; lname?: string; email?: string;
  phone?: string; company?: string; source?: string; created_at?: string;
  score?: number; ai_reason?: string; ai_next?: string;
};

export default function ContactsClient({ initial, workspaceId }:
  { initial: Contact[]; workspaceId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Contact[]>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ fname: '', lname: '', email: '', phone: '', company: '', source: 'website' });
  const [scoring, setScoring] = useState(false);
  const [summary, setSummary] = useState<{ id: string; text: string; status: string; next: string } | null>(null);
  const [sumBusy, setSumBusy] = useState('');

  async function scoreAll() {
    setScoring(true);
    try {
      const r = await fetch('/api/ai/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, limit: 20 }),
      });
      const d = await r.json();
      if (d.results) {
        const map: Record<string, any> = {};
        d.results.forEach((x: any) => { map[x.contact_id] = x; });
        setRows((rs) => [...rs].map((c) => map[c.id]
          ? { ...c, score: map[c.id].score, ai_reason: map[c.id].reason, ai_next: map[c.id].next_action }
          : c).sort((a, b) => (b.score || 0) - (a.score || 0)));
      }
    } catch { /* noop */ } finally { setScoring(false); }
  }

  async function summarize(id: string) {
    setSumBusy(id);
    try {
      const r = await fetch('/api/ai/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: id }),
      });
      const d = await r.json();
      if (d.ok) setSummary({ id, text: d.summary, status: d.status, next: d.next_step });
    } catch { /* noop */ } finally { setSumBusy(''); }
  }

  function scoreColor(s?: number) {
    if (!s) return 'var(--text-dim)';
    if (s >= 70) return 'var(--teal)';
    if (s >= 40) return 'var(--gold)';
    return 'var(--text-sec)';
  }

  async function save() {
    if (!f.fname.trim()) { setErr('First name required'); return; }
    setErr(''); setBusy(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspaceId,
          fname: f.fname.trim(), lname: f.lname.trim() || null,
          email: f.email.trim() || null, phone: f.phone.trim() || null,
          company: f.company.trim() || null, source: f.source,
        })
        .select().single();
      if (error) throw error;
      // fire automations instantly (welcome SMS etc.) — don't block the UI
      fetch('/api/contacts/created', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: (data as Contact).id }),
      }).catch(() => {});
      setRows([data as Contact, ...rows]);
      setF({ fname: '', lname: '', email: '', phone: '', company: '', source: 'website' });
      setOpen(false);
    } catch (e: any) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this contact?')) return;
    const prev = rows;
    setRows(rows.filter((r) => r.id !== id));
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) { alert('Delete failed'); setRows(prev); }
  }

  return (
    <>
      <div className="top">
        <div className="top-title">Contacts</div>
        <button className="btn" onClick={scoreAll} disabled={scoring}
          style={{ background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'rgba(45,212,191,0.3)' }}>
          {scoring ? <span className="spinner" /> : <><i className="ti ti-sparkles" /> AI Score All</>}
        </button>
        <button className="btn" onClick={() => setOpen(true)}>
          <i className="ti ti-plus" /> Add Contact
        </button>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr>
              <th>Name</th><th>Score</th><th>Email</th><th>Company</th><th>Source</th><th>AI</th><th></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty">No contacts yet. Add one — it saves to your real database.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><a href={`/dashboard/contacts/${c.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>{c.fname} {c.lname || ''}</a></td>
                  <td>
                    <span title={c.ai_reason || ''} style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, color: scoreColor(c.score) }}>
                      {c.score ?? '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-sec)' }}>{c.email || '—'}</td>
                  <td>{c.company || '—'}</td>
                  <td><span className="tag" style={{ background: 'var(--black5)', color: 'var(--text-dim)' }}>{c.source || '—'}</span></td>
                  <td>
                    <i className="ti ti-sparkles" title="AI summary"
                      style={{ cursor: 'pointer', color: sumBusy === c.id ? 'var(--text-dim)' : 'var(--teal)' }}
                      onClick={() => summarize(c.id)} />
                  </td>
                  <td>
                    <i className="ti ti-trash" style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => del(c.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {summary && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setSummary(null)}>
          <div className="modal" style={{ width: 440 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-sparkles" style={{ color: 'var(--teal)' }} /> AI Brief
            </h2>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: 14 }}>{summary.text}</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span className="tag" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>{summary.status}</span>
            </div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 4 }}>Next step</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{summary.next}</div>
            <div className="mfoot">
              <button className="btn-save" onClick={() => setSummary(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>Add Contact</h2>
            {err && <div className="auth-error">{err}</div>}
            <div className="frow">
              <div className="fg"><label>First Name</label>
                <input value={f.fname} onChange={(e) => setF({ ...f, fname: e.target.value })} /></div>
              <div className="fg"><label>Last Name</label>
                <input value={f.lname} onChange={(e) => setF({ ...f, lname: e.target.value })} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Email</label>
                <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="fg"><label>Phone</label>
                <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Company</label>
                <input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
              <div className="fg"><label>Source</label>
                <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="cold_outreach">Cold Outreach</option>
                  <option value="form">Form</option>
                  <option value="other">Other</option>
                </select></div>
            </div>
            <div className="mfoot">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-save" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
