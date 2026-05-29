'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const TRIGGERS = [
  { v: 'contact_created', label: 'New contact created' },
  { v: 'form_submitted', label: 'Form submitted' },
  { v: 'stage_changed', label: 'Deal stage changed' },
  { v: 'tag_added', label: 'Tag added' },
  { v: 'manual', label: 'Manual / API' },
];
const STEP_KINDS = [
  { v: 'send_email', label: '✉️ Send Email' },
  { v: 'send_sms', label: '💬 Send SMS' },
  { v: 'wait', label: '⏱️ Wait' },
  { v: 'add_tag', label: '🏷️ Add Tag' },
];

type Step = { kind: string; config: any };

export default function AutomationsClient({ workspaceId, initial }:
  { workspaceId: string; initial: any[] }) {
  const supabase = createClient();
  const [autos, setAutos] = useState<any[]>(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('contact_created');
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  function newAuto() {
    setEditing({ id: null }); setName('New Automation'); setTrigger('contact_created'); setSteps([]);
  }
  async function editAuto(a: any) {
    setEditing(a); setName(a.name); setTrigger(a.trigger);
    const { data: nodes } = await supabase.from('automation_nodes').select('*')
      .eq('automation_id', a.id).order('sort_order');
    const real = (nodes || []).filter((n: any) => !n.is_entry).map((n: any) => ({ kind: n.kind, config: n.config || {} }));
    setSteps(real);
  }
  function addStep(kind: string) {
    const def: any = kind === 'wait' ? { amount: 1, unit: 'days' } : kind === 'add_tag' ? { tag: '' } : kind === 'send_sms' ? { body: '' } : { subject: '', body: '' };
    setSteps([...steps, { kind, config: def }]);
  }
  function updateStep(i: number, key: string, val: any) {
    setSteps((s) => s.map((x, idx) => idx === i ? { ...x, config: { ...x.config, [key]: val } } : x));
  }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)); }

  async function save() {
    setBusy(true);
    try {
      let autoId = editing.id;
      if (!autoId) {
        const { data } = await supabase.from('automations').insert({
          workspace_id: workspaceId, name, trigger, active: false,
        }).select().single();
        autoId = data.id;
        setAutos([data, ...autos]);
      } else {
        await supabase.from('automations').update({ name, trigger }).eq('id', autoId);
        setAutos((a) => a.map((x) => x.id === autoId ? { ...x, name, trigger } : x));
        // wipe old nodes to rebuild
        await supabase.from('automation_nodes').delete().eq('automation_id', autoId);
      }
      // build entry + step chain
      const { data: entry } = await supabase.from('automation_nodes').insert({
        workspace_id: workspaceId, automation_id: autoId, kind: 'trigger', is_entry: true, label: 'Trigger', sort_order: 0,
      }).select().single();
      let prevId = entry.id;
      for (let i = 0; i < steps.length; i++) {
        const { data: node } = await supabase.from('automation_nodes').insert({
          workspace_id: workspaceId, automation_id: autoId, kind: steps[i].kind,
          config: steps[i].config, label: steps[i].kind, sort_order: i + 1,
        }).select().single();
        await supabase.from('automation_nodes').update({ next_node_id: node.id }).eq('id', prevId);
        prevId = node.id;
      }
      setEditing(null);
    } finally { setBusy(false); }
  }

  async function toggleActive(a: any) {
    const active = !a.active;
    setAutos((as) => as.map((x) => x.id === a.id ? { ...x, active } : x));
    await supabase.from('automations').update({ active }).eq('id', a.id);
  }
  async function del(id: string) {
    if (!confirm('Delete automation?')) return;
    setAutos((as) => as.filter((x) => x.id !== id));
    await supabase.from('automations').delete().eq('id', id);
  }

  if (editing) {
    return (
      <>
        <div className="top">
          <div className="top-title">{editing.id ? 'Edit' : 'New'} Automation</div>
          <button className="btn-ghost" onClick={() => setEditing(null)} style={{ height: 30 }}>Cancel</button>
          <button className="btn-save" onClick={save} disabled={busy} style={{ height: 30 }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
        <div className="content" style={{ maxWidth: 640 }}>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="frow">
              <div className="fg"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="fg"><label>Trigger</label>
                <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                  {TRIGGERS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select></div>
            </div>
          </div>
          {/* the flow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div className="panel" style={{ width: '100%', textAlign: 'center', borderColor: 'var(--red)', background: 'var(--red-dim)' }}>
              <strong>⚡ {TRIGGERS.find((t) => t.v === trigger)?.label}</strong>
            </div>
            {steps.map((s, i) => (
              <div key={i} style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>↓</div>
                <div className="panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>{STEP_KINDS.find((k) => k.v === s.kind)?.label}</strong>
                    <i className="ti ti-trash" style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => removeStep(i)} />
                  </div>
                  {s.kind === 'wait' && (
                    <div className="frow">
                      <div className="fg"><label>Amount</label><input type="number" value={s.config.amount} onChange={(e) => updateStep(i, 'amount', +e.target.value)} /></div>
                      <div className="fg"><label>Unit</label>
                        <select value={s.config.unit} onChange={(e) => updateStep(i, 'unit', e.target.value)}>
                          <option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option>
                        </select></div>
                    </div>
                  )}
                  {s.kind === 'send_email' && (
                    <>
                      <div className="fg" style={{ marginBottom: 8 }}><label>Subject</label><input value={s.config.subject} onChange={(e) => updateStep(i, 'subject', e.target.value)} /></div>
                      <div className="fg"><label>Body (use {'{{first_name}}'})</label><textarea value={s.config.body} onChange={(e) => updateStep(i, 'body', e.target.value)} style={{ minHeight: 70, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 9, color: 'var(--text)', fontSize: 12.5 }} /></div>
                    </>
                  )}
                  {s.kind === 'send_sms' && (
                    <div className="fg"><label>Message</label><textarea value={s.config.body} onChange={(e) => updateStep(i, 'body', e.target.value)} style={{ minHeight: 60, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 9, color: 'var(--text)', fontSize: 12.5 }} /></div>
                  )}
                  {s.kind === 'add_tag' && (
                    <div className="fg"><label>Tag</label><input value={s.config.tag} onChange={(e) => updateStep(i, 'tag', e.target.value)} /></div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>↓</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {STEP_KINDS.map((k) => (
                <button key={k.v} className="btn" onClick={() => addStep(k.v)}>+ {k.label}</button>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="top">
        <div className="top-title">Automations</div>
        <button className="btn" onClick={newAuto}><i className="ti ti-plus" /> New Automation</button>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th>Name</th><th>Trigger</th><th>Status</th><th>Enrolled</th><th></th></tr></thead>
            <tbody>
              {autos.length === 0 && <tr><td colSpan={5} className="empty">No automations. Build one — the engine runs them 24/7 (wait, email, SMS, tags).</td></tr>}
              {autos.map((a) => (
                <tr key={a.id}>
                  <td style={{ cursor: 'pointer' }} onClick={() => editAuto(a)}>{a.name}</td>
                  <td style={{ color: 'var(--text-sec)' }}>{TRIGGERS.find((t) => t.v === a.trigger)?.label || a.trigger}</td>
                  <td>
                    <span onClick={() => toggleActive(a)} className="tag" style={{ cursor: 'pointer', background: a.active ? 'var(--teal-dim)' : 'var(--black5)', color: a.active ? 'var(--teal)' : 'var(--text-dim)' }}>
                      {a.active ? '● Active' : '○ Paused'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>{a.enrolled_count || 0}</td>
                  <td>
                    <i className="ti ti-edit" style={{ cursor: 'pointer', color: 'var(--text-sec)', marginRight: 12 }} onClick={() => editAuto(a)} />
                    <i className="ti ti-trash" style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => del(a.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
