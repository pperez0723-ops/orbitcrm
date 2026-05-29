'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function ContactDetail({ contact, notes, activity, deals }: any) {
  const supabase = createClient();
  const [noteList, setNoteList] = useState<any[]>(notes);
  const [note, setNote] = useState('');
  const [brief, setBrief] = useState<any>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [compose, setCompose] = useState<{ subject: string; body: string } | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);

  async function addNote() {
    if (!note.trim()) return;
    const { data } = await supabase.from('notes').insert({
      workspace_id: contact.workspace_id, contact_id: contact.id, body: note.trim(),
    }).select().single();
    if (data) { setNoteList([data, ...noteList]); setNote(''); }
  }

  async function getBrief() {
    setBriefBusy(true);
    try {
      const r = await fetch('/api/ai/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contact.id }) });
      const d = await r.json();
      if (d.ok) setBrief(d);
    } catch { /* noop */ } finally { setBriefBusy(false); }
  }

  async function draftEmail() {
    setComposeBusy(true);
    try {
      const r = await fetch('/api/ai/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contact.id, channel: 'email', instruction: 'a friendly follow-up' }) });
      const d = await r.json();
      if (d.body) setCompose({ subject: d.subject || '', body: d.body });
    } catch { /* noop */ } finally { setComposeBusy(false); }
  }

  const sc = contact.score >= 70 ? 'var(--teal)' : contact.score >= 40 ? 'var(--gold)' : 'var(--text-sec)';

  return (
    <>
      <div className="top">
        <a href="/dashboard/contacts" style={{ color: 'var(--text-dim)' }}><i className="ti ti-arrow-left" /></a>
        <div className="top-title">{contact.fname} {contact.lname || ''}</div>
        <button className="btn" onClick={getBrief} disabled={briefBusy} style={{ background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'rgba(45,212,191,0.3)' }}>
          {briefBusy ? <span className="spinner" /> : <><i className="ti ti-sparkles" /> AI Brief</>}
        </button>
        <button className="btn" onClick={draftEmail} disabled={composeBusy}><i className="ti ti-mail" /> AI Email</button>
      </div>
      <div className="content" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* left: details */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--red-dim)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18 }}>
                {contact.fname?.[0]}{contact.lname?.[0] || ''}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{contact.fname} {contact.lname || ''}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{contact.company || ''}</div>
              </div>
            </div>
            <Row label="Score" value={<span style={{ color: sc, fontFamily: 'Rajdhani', fontWeight: 700 }}>{contact.score ?? '—'}</span>} />
            <Row label="Email" value={contact.email || '—'} />
            <Row label="Phone" value={contact.phone || '—'} />
            <Row label="Source" value={contact.source || '—'} />
            {contact.tags?.length > 0 && <Row label="Tags" value={contact.tags.join(', ')} />}
          </div>
          {deals.length > 0 && (
            <div className="panel">
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>Deals</div>
              {deals.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
                  <span>{d.title}</span><span style={{ color: 'var(--teal)' }}>${d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* right: AI brief, compose, notes, timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {brief && (
            <div className="panel" style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--teal)', marginBottom: 8 }}>✨ AI Brief</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{brief.summary}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)' }}><strong>Status:</strong> {brief.status}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sec)' }}><strong>Next:</strong> {brief.next_step}</div>
            </div>
          )}
          {compose && (
            <div className="panel">
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>✉️ AI Drafted Email</div>
              <input className="auth-input" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={{ marginBottom: 8 }} />
              <textarea value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} style={{ width: '100%', minHeight: 120, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 10, color: 'var(--text)', fontSize: 13 }} />
            </div>
          )}
          <div className="panel">
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 8 }}>Add note</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="auth-input" style={{ marginBottom: 0 }} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Log a note…" />
              <button className="btn-save" onClick={addNote}>Add</button>
            </div>
          </div>
          <div className="panel">
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>Timeline</div>
            {noteList.map((n: any) => (
              <TL key={n.id} icon="ti-note" text={n.body} time={n.created_at} />
            ))}
            {activity.map((a: any) => (
              <TL key={a.id} icon={a.icon || 'ti-point'} text={a.text} time={a.created_at} />
            ))}
            {noteList.length === 0 && activity.length === 0 && <div className="empty">No activity yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: any) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ color: 'var(--text-dim)' }}>{label}</span><span>{value}</span>
  </div>;
}
function TL({ icon, text, time }: any) {
  return <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <i className={'ti ' + icon} style={{ color: 'var(--red)', marginTop: 2 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12.5 }}>{text}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{time ? new Date(time).toLocaleString() : ''}</div>
    </div>
  </div>;
}
