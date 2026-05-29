'use client';
import { useState } from 'react';

export default function PublicForm({ form }: { form: any }) {
  const fields = Array.isArray(form.fields) && form.fields.length ? form.fields
    : [{ key: 'name', label: 'Name', type: 'text', required: true },
       { key: 'email', label: 'Email', type: 'email', required: true },
       { key: 'phone', label: 'Phone', type: 'tel' }];
  const [vals, setVals] = useState<any>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch(`/api/forms/${form.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals),
      });
      const d = await r.json();
      if (d.redirect) { window.location.href = d.redirect; return; }
      setDone(true);
    } catch { /* noop */ } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">Orbit<span>CRM</span></div>
        <div className="auth-tag">{form.name}</div>
        {done ? (
          <p style={{ textAlign: 'center', color: 'var(--teal)', fontSize: 14 }}>✓ Thanks! We'll be in touch shortly.</p>
        ) : (
          <>
            {fields.map((f: any) => (
              <div key={f.key}>
                <label className="auth-label">{f.label}{f.required && ' *'}</label>
                <input className="auth-input" type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
                  value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              </div>
            ))}
            <button className="auth-btn" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Submit'}</button>
          </>
        )}
      </div>
    </div>
  );
}
