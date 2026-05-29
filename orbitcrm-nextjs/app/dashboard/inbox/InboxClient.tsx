'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function InboxClient({ workspaceId, conversations }:
  { workspaceId: string; conversations: any[] }) {
  const supabase = createClient();
  const [convos] = useState<any[]>(conversations);
  const [active, setActive] = useState<any | null>(conversations[0] || null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  async function openConvo(c: any) {
    setActive(c); setMessages([]); setLoading(true); setDraft('');
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', c.id).order('created_at', { ascending: true });
    setMessages(data || []); setLoading(false);
    if (c.unread_count > 0) await supabase.from('conversations').update({ unread_count: 0 }).eq('id', c.id);
  }

  async function suggestReply() {
    if (!active) return;
    setAiBusy(true);
    try {
      const r = await fetch('/api/ai/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: active.id }) });
      const d = await r.json();
      if (d.reply) setDraft(d.reply);
    } catch { /* noop */ } finally { setAiBusy(false); }
  }

  async function send() {
    if (!draft.trim() || !active) return;
    const body = draft.trim(); setDraft('');
    const { data } = await supabase.from('messages').insert({
      workspace_id: workspaceId, conversation_id: active.id, contact_id: active.contact_id,
      channel: active.channel, direction: 'out', body, status: 'queued',
    }).select().single();
    if (data) setMessages((m) => [...m, data]);
  }

  return (
    <>
      <div className="top"><div className="top-title">Inbox</div></div>
      <div className="content" style={{ display: 'flex', gap: 0, padding: 0, height: 'calc(100vh - 52px)' }}>
        {/* conversation list */}
        <div style={{ width: 280, borderRight: '1px solid var(--border-dim)', overflowY: 'auto' }}>
          {convos.length === 0 && <div className="empty">No conversations yet. They appear when messages arrive (inbound webhooks) or Autopilot queues outreach.</div>}
          {convos.map((c) => (
            <div key={c.id} onClick={() => openConvo(c)}
              style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-dim)', cursor: 'pointer', background: active?.id === c.id ? 'var(--red-dim)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.contacts?.fname} {c.contacts?.lname || ''}</span>
                {c.unread_count > 0 && <span className="tag" style={{ background: 'var(--red)', color: '#fff' }}>{c.unread_count}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, textTransform: 'uppercase', letterSpacing: .5 }}>{c.channel}</div>
            </div>
          ))}
        </div>
        {/* thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!active && <div className="empty" style={{ margin: 'auto' }}>Select a conversation</div>}
          {active && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dim)' }}>
                <div style={{ fontWeight: 600 }}>{active.contacts?.fname} {active.contacts?.lname || ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{active.contacts?.company || ''} · {active.channel}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading && <div className="spinner" style={{ margin: 'auto' }} />}
                {messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, background: m.direction === 'out' ? 'var(--red)' : 'var(--black4)', color: m.direction === 'out' ? '#fff' : 'var(--text)' }}>
                      {m.subject && <div style={{ fontWeight: 600, marginBottom: 3 }}>{m.subject}</div>}
                      {m.body}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, textAlign: m.direction === 'out' ? 'right' : 'left' }}>{m.status}</div>
                  </div>
                ))}
                {!loading && messages.length === 0 && <div className="empty">No messages in this thread yet.</div>}
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button className="btn" onClick={suggestReply} disabled={aiBusy}
                    style={{ background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'rgba(45,212,191,0.3)' }}>
                    {aiBusy ? <span className="spinner" /> : <><i className="ti ti-sparkles" /> Suggest Reply</>}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a reply…"
                    style={{ flex: 1, background: 'var(--black4)', border: '1px solid var(--border-dim)', borderRadius: 9, padding: 10, color: 'var(--text)', fontSize: 13, resize: 'none', minHeight: 60, outline: 'none' }} />
                  <button className="btn-save" onClick={send}><i className="ti ti-send" /></button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
