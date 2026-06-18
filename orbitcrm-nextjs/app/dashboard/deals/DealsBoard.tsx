'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Stage = { id: string; name: string; color: string; probability: number; is_won: boolean; is_lost: boolean };
type Deal = { id: string; title: string; value: number; stage_id: string; contact_id: string; contacts?: any };

export default function DealsBoard({ workspaceId, pipelineId, stages, initialDeals, contacts }:
                                   { workspaceId: string; pipelineId: string | null; stages: Stage[]; initialDeals: Deal[]; contacts: any[] }) {
    const supabase = createClient();
    const [deals, setDeals] = useState<Deal[]>(initialDeals);
    const [drag, setDrag] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Deal | null>(null);
    const [f, setF] = useState({ contact_id: '', title: '', value: '' });
    const [busy, setBusy] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editStage, setEditStage] = useState('');
    const [saving, setSaving] = useState(false);

  async function move(dealId: string, stageId: string) {
        setDeals((ds) => ds.map((d) => d.id === dealId ? { ...d, stage_id: stageId } : d));
        const stage = stages.find((s) => s.id === stageId);
        const patch: any = { stage_id: stageId };
        if (stage?.is_won) patch.won_at = new Date().toISOString();
        if (stage?.is_lost) patch.lost_at = new Date().toISOString();
        await supabase.from('deals').update(patch).eq('id', dealId);
        if (selected?.id === dealId) setSelected((d) => d ? { ...d, stage_id: stageId } : d);
  }

  async function create() {
        if (!f.contact_id || !pipelineId) return;
        setBusy(true);
        const firstStage = stages[0];
        const { data, error } = await supabase.from('deals').insert({
                workspace_id: workspaceId, contact_id: f.contact_id, pipeline_id: pipelineId,
                stage_id: firstStage.id, title: f.title || 'New Deal', value: parseFloat(f.value) || 0,
        }).select('*, contacts(fname,lname,company)').single();
        setBusy(false);
        if (!error && data) { setDeals([data as Deal, ...deals]); setF({ contact_id: '', title: '', value: '' }); setOpen(false); }
  }

  async function del(id: string) {
        if (!confirm('Delete this deal?')) return;
        setDeals((ds) => ds.filter((d) => d.id !== id));
        if (selected?.id === id) setSelected(null);
        await supabase.from('deals').delete().eq('id', id);
  }

  async function saveEdits() {
        if (!selected) return;
        setSaving(true);
        const patch: any = { title: editTitle, value: parseFloat(editValue) || 0, stage_id: editStage };
        await supabase.from('deals').update(patch).eq('id', selected.id);
        setDeals((ds) => ds.map((d) => d.id === selected.id ? { ...d, ...patch } : d));
        setSelected((d) => d ? { ...d, ...patch } : d);
        setSaving(false);
  }

  function openDetail(deal: Deal) {
        setSelected(deal);
        setEditTitle(deal.title);
        setEditValue(String(deal.value));
        setEditStage(deal.stage_id);
  }

  const fmt = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n;
    const stageTotal = (sid: string) => deals.filter((d) => d.stage_id === sid).reduce((a, d) => a + Number(d.value || 0), 0);
    const selectedStage = stages.find((s) => s.id === selected?.stage_id);

  return (
        <>
              <div className="top">
                      <div className="top-title">Pipeline</div>div>
                      <button className="btn" onClick={() => setOpen(true)}>+ New Deal</button>button>
              </div>div>
              <div className="content" style={{ overflowX: 'auto' }}>
                      <div style={{ display: 'flex', gap: 12, minHeight: 400, paddingBottom: 10 }}>
                        {stages.map((s) => {
                      const col = deals.filter((d) => d.stage_id === s.id);
                      return (
                                      <div key={s.id}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={() => drag && move(drag, s.id)}
                                                        style={{ minWidth: 240, width: 240, flexShrink: 0, background: 'var(--black3)', borderRadius: 12, border: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column' }}>
                                                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-dim)', borderTop: `2px solid ${s.color}`, borderRadius: '12px 12px 0 0' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                            <span style={{ fontFamily: 'Rajdhani', fontWeight: 600, fontSize: 13 }}>{s.name}</span>span>
                                                                                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{col.length}</span>span>
                                                                        </div>div>
                                                                        <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{fmt(stageTotal(s.id))}</div>div>
                                                      </div>div>
                                                      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                                        {col.map((d) => (
                                                                              <div key={d.id} draggable
                                                                                                      onDragStart={() => setDrag(d.id)}
                                                                                                      onDragEnd={() => setDrag(null)}
                                                                                                      onClick={() => openDetail(d)}
                                                                                                      style={{ padding: 11, background: 'var(--black4)', borderRadius: 9, border: `1px solid ${selected?.id === d.id ? s.color : 'var(--border-dim)'}`, cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s', boxShadow: selected?.id === d.id ? `0 0 0 2px ${s.color}33` : 'none' }}>
                                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                                                                                                            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{d.title}</span>span>
                                                                                                                            <span style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13, flexShrink: 0 }}
                                                                                                                                                        onClick={(e) => { e.stopPropagation(); del(d.id); }}>✕</span>span>
                                                                                                      </div>div>
                                                                                {d.contacts && (
                                                                                                                                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                                                                                                                                  {d.contacts.fname} {d.contacts.lname || ''}
                                                                                                                                  {d.contacts.company ? ` · ${d.contacts.company}` : ''}
                                                                                                                                  </div>div>
                                                                                                    )}
                                                                                                    <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginTop: 6, fontFamily: 'Rajdhani' }}>{fmt(Number(d.value || 0))}</div>div>
                                                                              </div>div>
                                                                            ))}
                                                        {col.length === 0 && (
                                                                              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>Drop deals here</div>div>
                                                                        )}
                                                      </div>div>
                                      </div>div>
                                    );
        })}
                      </div>div>
              </div>div>
        
          {/* Deal Detail Drawer */}
          {selected && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
                            <div style={{ marginLeft: 'auto', width: 360, background: '#0d0d14', borderLeft: '1px solid var(--border-dim)', height: '100%', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Rajdhani' }}>Deal Details</span>span>
                                                      <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>✕</button>button>
                                        </div>div>
                              {selected.contacts && (
                                  <div style={{ background: 'var(--black3)', borderRadius: 10, padding: '12px 14px' }}>
                                                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Contact</div>div>
                                                  <div style={{ fontWeight: 600 }}>{selected.contacts.fname} {selected.contacts.lname || ''}</div>div>
                                    {selected.contacts.company && <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 2 }}>{selected.contacts.company}</div>div>}
                                  </div>div>
                                        )}
                                        <div>
                                                      <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Deal Title</label>label>
                                                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                                                        style={{ width: '100%', background: 'var(--black3)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
                                        </div>div>
                                        <div>
                                                      <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Value ($)</label>label>
                                                      <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                                                        style={{ width: '100%', background: 'var(--black3)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
                                        </div>div>
                                        <div>
                                                      <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Stage</label>label>
                                                      <select value={editStage} onChange={(e) => setEditStage(e.target.value)}
                                                                        style={{ width: '100%', background: 'var(--black3)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 14, boxSizing: 'border-box' }}>
                                                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>option>)}
                                                      </select>select>
                                        </div>div>
                              {selectedStage && (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: selectedStage.color, marginTop: 3 }} />
                                                  <span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{selectedStage.name}</span>span>
                                  </div>div>
                                        )}
                                        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                                                      <button onClick={() => del(selected.id)}
                                                                        style={{ flex: 1, padding: '10px 0', background: 'rgba(232,48,58,0.15)', border: '1px solid rgba(232,48,58,0.3)', borderRadius: 9, color: '#e8303a', cursor: 'pointer', fontWeight: 600 }}>
                                                                      Delete
                                                      </button>button>
                                                      <button onClick={saveEdits} disabled={saving}
                                                                        style={{ flex: 2, padding: '10px 0', background: 'var(--accent)', border: 'none', borderRadius: 9, color: '#000', cursor: 'pointer', fontWeight: 700 }}>
                                                        {saving ? 'Saving…' : 'Save Changes'}
                                                      </button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        
          {/* New Deal Modal */}
          {open && (
                  <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
                            <div className="modal">
                                        <h2>New Deal</h2>h2>
                                        <div className="fg" style={{ marginBottom: 12 }}>
                                                      <label>Contact</label>label>
                                                      <select value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
                                                                      <option value="">— select a contact —</option>option>
                                                        {contacts.map((c) => (
                                      <option key={c.id} value={c.id}>{c.fname} {c.lname || ''} {c.company ? `(${c.company})` : ''}</option>option>
                                    ))}
                                                      </select>select>
                                        </div>div>
                                        <div className="frow">
                                                      <div className="fg"><label>Title</label>label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Deal name…" /></div>div>
                                                      <div className="fg"><label>Value ($)</label>label><input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="0" /></div>div>
                                        </div>div>
                                        <div className="mfoot">
                                                      <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>button>
                                                      <button className="btn-save" onClick={create} disabled={busy || !f.contact_id}>{busy ? 'Saving…' : 'Create Deal'}</button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        </>>
      );
}</>
