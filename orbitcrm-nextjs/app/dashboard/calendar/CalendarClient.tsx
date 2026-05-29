'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function CalendarClient({ workspaceId, initial, contacts }:
  { workspaceId: string; initial: any[]; contacts: any[] }) {
  const supabase = createClient();
  const [appts, setAppts] = useState<any[]>(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', contact_id: '', starts_at: '', duration_min: '30' });

  async function add() {
    if (!f.title.trim() || !f.starts_at) return;
    const { data } = await supabase.from('appointments').insert({
      workspace_id: workspaceId, title: f.title.trim(), contact_id: f.contact_id || null,
      starts_at: new Date(f.starts_at).toISOString(), duration_min: parseInt(f.duration_min) || 30, status: 'confirmed',
    }).select('*, contacts(fname,lname)').single();
    if (data) { setAppts([...appts, data].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))); setF({ title: '', contact_id: '', starts_at: '', duration_min: '30' }); setOpen(false); }
  }

  async function cancel(id: string) {
    setAppts((a) => a.map((x) => x.id === id ? { ...x, status: 'cancelled' } : x));
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  }

  const upcoming = appts.filter((a) => new Date(a.starts_at) >= new Date(Date.now() - 3600e3));

  return (
    <>
      <div className="top">
        <div className="top-title">Calendar</div>
        <button className="btn" onClick={() => setOpen(true)}><i className="ti ti-plus" /> New Appointment</button>
      </div>
      <div className="content">
        <div className="panel">
          <div style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Upcoming</div>
          {upcoming.length === 0 && <div className="empty">No upcoming appointments. The voice agent books straight into here.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map((a) => {
              const dt = new Date(a.starts_at);
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: 'var(--black4)', borderRadius: 9, opacity: a.status === 'cancelled' ? 0.4 : 1 }}>
                  <div style={{ textAlign: 'center', minWidth: 50 }}>
                    <div style={{ fontFamily: 'Rajdhani', fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{dt.getDate()}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{dt.toLocaleString('en', { month: 'short' })}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textDecoration: a.status === 'cancelled' ? 'line-through' : 'none' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                      {dt.toLocaleString('en', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {a.duration_min}min
                      {a.contacts && ` · ${a.contacts.fname} ${a.contacts.lname || ''}`}
                      {a.booked_online && ' · 📞 voice'}
                    </div>
                  </div>
                  {a.status !== 'cancelled' && <i className="ti ti-x" style={{ cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => cancel(a.id)} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>New Appointment</h2>
            <div className="fg" style={{ marginBottom: 12 }}><label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="frow">
              <div className="fg"><label>Contact</label>
                <select value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
                  <option value="">— none —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.fname} {c.lname || ''}</option>)}
                </select></div>
              <div className="fg"><label>Duration (min)</label><input type="number" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></div>
            </div>
            <div className="fg" style={{ marginBottom: 12 }}><label>Date &amp; time</label><input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
            <div className="mfoot">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-save" onClick={add}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
