'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function FormsClient({ workspaceId, initial }:
  { workspaceId: string; initial: any[] }) {
  const supabase = createClient();
  const [forms, setForms] = useState<any[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');

  // capture origin client-side for share links
  if (typeof window !== 'undefined' && !origin) setOrigin(window.location.origin);

  async function add() {
    if (!name.trim()) return;
    const { data } = await supabase.from('forms').insert({
      workspace_id: workspaceId, name: name.trim(),
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'phone', label: 'Phone', type: 'tel' },
      ], active: true,
    }).select().single();
    if (data) { setForms([data, ...forms]); setName(''); setOpen(false); }
  }

  function copyLink(id: string) {
    const url = `${origin}/f/${id}`;
    navigator.clipboard?.writeText(url);
    alert('Form link copied:\n' + url);
  }

  return (
    <>
      <div className="top">
        <div className="top-title">Forms</div>
        <button className="btn" onClick={() => setOpen(true)}><i className="ti ti-plus" /> New Form</button>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th>Name</th><th>Submissions</th><th>Link</th><th></th></tr></thead>
            <tbody>
              {forms.length === 0 && <tr><td colSpan={4} className="empty">No forms yet. Create one — submissions create real contacts &amp; can auto-enroll in automations.</td></tr>}
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td style={{ color: 'var(--text-sec)' }}>{f.submissions || 0}</td>
                  <td><code style={{ fontSize: 11, color: 'var(--text-dim)' }}>/f/{f.id.slice(0, 8)}…</code></td>
                  <td><button className="btn" onClick={() => copyLink(f.id)}><i className="ti ti-link" /> Copy link</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>New Form</h2>
            <div className="fg" style={{ marginBottom: 12 }}><label>Form name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact Us" /></div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Starts with Name, Email, Phone fields. Submissions create contacts automatically.</p>
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
