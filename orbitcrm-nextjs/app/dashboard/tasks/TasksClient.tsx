'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function TasksClient({ workspaceId, initial, contacts }:
  { workspaceId: string; initial: any[]; contacts: any[] }) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', contact_id: '', due_date: '', priority: 'medium' });

  async function add() {
    if (!f.title.trim()) return;
    const { data } = await supabase.from('tasks').insert({
      workspace_id: workspaceId, title: f.title.trim(), contact_id: f.contact_id || null,
      due_date: f.due_date || null, priority: f.priority,
    }).select('*, contacts(fname,lname)').single();
    if (data) { setTasks([data, ...tasks]); setF({ title: '', contact_id: '', due_date: '', priority: 'medium' }); setOpen(false); }
  }

  async function toggle(t: any) {
    const done = !t.done;
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done } : x));
    await supabase.from('tasks').update({ done }).eq('id', t.id);
  }

  const pc: Record<string, string> = { high: 'var(--red)', medium: 'var(--gold)', low: 'var(--teal)' };

  return (
    <>
      <div className="top">
        <div className="top-title">Tasks</div>
        <button className="btn" onClick={() => setOpen(true)}><i className="ti ti-plus" /> New Task</button>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th></th><th>Task</th><th>Contact</th><th>Due</th><th>Priority</th></tr></thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={5} className="empty">No tasks. Autopilot can create these for hot leads.</td></tr>}
              {tasks.map((t) => (
                <tr key={t.id} style={{ opacity: t.done ? 0.5 : 1 }}>
                  <td><input type="checkbox" checked={t.done} onChange={() => toggle(t)} /></td>
                  <td style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</td>
                  <td style={{ color: 'var(--text-sec)' }}>{t.contacts ? `${t.contacts.fname} ${t.contacts.lname || ''}` : '—'}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{t.due_date || '—'}</td>
                  <td><span className="tag" style={{ border: `1px solid ${pc[t.priority]}`, color: pc[t.priority] }}>{t.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>New Task</h2>
            <div className="fg" style={{ marginBottom: 12 }}><label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="frow">
              <div className="fg"><label>Contact</label>
                <select value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
                  <option value="">— none —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.fname} {c.lname || ''}</option>)}
                </select></div>
              <div className="fg"><label>Due</label><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
              <div className="fg"><label>Priority</label>
                <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select></div>
            </div>
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
