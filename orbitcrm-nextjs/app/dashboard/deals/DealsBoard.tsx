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
  const [f, setF] = useState({ contact_id: '', title: '', value: '' });
  const [busy, setBusy] = useState(false);

  async function move(dealId: string, stageId: string) {
    setDeals((ds) => ds.map((d) => d.id === dealId ? { ...d, stage_id: stageId } : d));
    const stage = stages.find((s) => s.id === stageId);
    const patch: any = { stage_id: stageId };
    if (stage?.is_won) patch.won_at = new Date().toISOString();
    if (stage?.is_lost) patch.lost_at = new Date().toISOString();
    await supabase.from('deals').update(patch).eq('id', dealId);
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
    if (!confirm('Delete deal?')) return;
    setDeals((ds) => ds.filter((d) => d.id !== id));
    await supabase.from('deals').delete().eq('id', id);
  }

  const fmt = (n: number) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n;
  const stageTotal = (sid: string) => deals.filter((d) => d.stage_id === sid).reduce((a, d) => a + Number(d.value || 0), 0);

  return (
    <>
      <div className="top">
        <div className="top-title">Pipeline</div>
        <button className="btn" onClick={() => setOpen(true)}><i className="ti ti-plus" /> New Deal</button>
      </div>
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
                    <span style={{ fontFamily: 'Rajdhani', fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{col.length}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 2 }}>{fmt(stageTotal(s.id))}</div>
                </div>
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {col.map((d) => (
                    <div key={d.id} draggable onDragStart={() => setDrag(d.id)} onDragEnd={() => setDrag(null)}
                      style={{ padding: 11, background: 'var(--black4)', borderRadius: 9, border: '1px solid var(--border-dim)', cursor: 'grab' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{d.title}</span>
                        <i className="ti ti-x" style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13 }} onClick={() => del(d.id)} />
                      </div>
                      {d.contacts && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{d.contacts.fname} {d.contacts.lname || ''}</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginTop: 6, fontFamily: 'Rajdhani' }}>{fmt(Number(d.value || 0))}</div>
                    </div>
                  ))}
                  {col.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>Drop deals here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <h2>New Deal</h2>
            <div className="fg" style={{ marginBottom: 12 }}><label>Contact</label>
              <select value={f.contact_id} onChange={(e) => setF({ ...f, contact_id: e.target.value })}>
                <option value="">— select —</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.fname} {c.lname || ''} {c.company ? `(${c.company})` : ''}</option>)}
              </select></div>
            <div className="frow">
              <div className="fg"><label>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="fg"><label>Value ($)</label><input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
            </div>
            <div className="mfoot">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-save" onClick={create} disabled={busy || !f.contact_id}>{busy ? 'Saving…' : 'Create Deal'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
