'use client';
import { useEffect, useState, useCallback } from 'react';

const SUPA = 'https://jlbnieorltkfezixulxc.supabase.co';
const SECRET = 'whk_orbit_9f3c1a7e8b2d4056aa1199ccee';
const WS = '4ca1ee34-dffc-4c75-b2a8-2a1067f66bae';

const CHANNELS = [
  { key: 'all', label: 'All', icon: '✦' },
  { key: 'sms', label: 'SMS', icon: '💬' },
  { key: 'email', label: 'Email', icon: '✉' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '🟢' },
];

async function api(action: any, extra: any) {
  const r = await fetch(SUPA + '/functions/v1/inbox', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ secret: SECRET, workspace_id: WS, action: action }, extra || {})),
  });
  return r.json();
}
async function sendMsg(payload: any) {
  const r = await fetch(SUPA + '/functions/v1/send-message', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ secret: SECRET, workspace_id: WS }, payload)),
  });
  return r.json();
}

export default function InboxPage() {
  const [channel, setChannel] = useState('all');
  const [counts, setCounts] = useState<any>({});
  const [convos, setConvos] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [thread, setThread] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [composing, setComposing] = useState(false);
  const [cChannel, setCChannel] = useState('sms');
  const [cQuery, setCQuery] = useState('');
  const [cResults, setCResults] = useState<any[]>([]);
  const [cContact, setCContact] = useState<any>(null);
  const [cSubject, setCSubject] = useState('');
  const [cBody, setCBody] = useState('');

  const loadList = useCallback(async (ch: any) => {
    setLoading(true);
    const l = await api('list', { channel: ch, limit: 60 });
    const c = await api('counts', {});
    setConvos(l.conversations || []); setCounts(c.counts || {}); setLoading(false);
  }, []);
  useEffect(() => { loadList(channel); }, [channel, loadList]);

  function flash(t: any) { setToast(t); setTimeout(function () { setToast(''); }, 3500); }

  async function openConv(cv: any) {
    setComposing(false); setActive(cv); setThread(null); setDraft(''); setSubject('');
    const t = await api('thread', { conversation_id: cv.conversation_id });
    setThread(t);
    const d = (t.messages || []).find(function (m: any) { return m.status === 'draft'; });
    if (d) { setDraft(d.body || ''); setSubject(d.subject || ''); }
  }

  async function sendDraft() {
    if (!active || !draft.trim()) return;
    setSending(true);
    const d = ((thread && thread.messages) || []).find(function (m: any) { return m.status === 'draft'; });
    const r = await sendMsg({ contact_id: active.contact_id, channel: active.channel, body: draft, subject: subject, message_id: (d && d.id) || null, conversation_id: active.conversation_id });
    setSending(false);
    if (r.ok) { flash('Sent ✔'); await openConv(active); loadList(channel); } else { flash('Failed: ' + (r.error || 'unknown')); }
  }

  function startCompose() {
    setComposing(true); setActive(null); setThread(null);
    setCChannel('sms'); setCQuery(''); setCResults([]); setCContact(null); setCSubject(''); setCBody('');
  }
  async function searchContacts(q: any) {
    setCQuery(q);
    const r = await api('search', { q: q });
    setCResults(r.contacts || []);
  }
  async function sendNew() {
    if (!cContact || !cBody.trim()) { flash('Pick a contact and write a message.'); return; }
    setSending(true);
    const r = await sendMsg({ contact_id: cContact.id, channel: cChannel, body: cBody, subject: cSubject });
    setSending(false);
    if (r.ok) { flash('Sent ✔'); setComposing(false); loadList(channel); } else { flash('Failed: ' + (r.error || 'unknown')); }
  }
  const iconFor = function (ch: any) { const f = CHANNELS.find(function (x: any) { return x.key === ch; }); return f ? f.icon : '✦'; };

  return (
    <div style={S.wrap}>
      <div style={S.list}>
        <div style={S.head}>
          <div style={S.headRow}>
            <span style={S.title}>INBOX</span>
            <button onClick={startCompose} style={S.newBtn}>+ New</button>
          </div>
          <span style={S.sub}>{(counts.all || 0) + ' conversations · ' + (counts.drafts || 0) + ' drafts'}</span>
        </div>
        <div style={S.tabs}>
          {CHANNELS.map(function (c: any) {
            const n = c.key === 'all' ? (counts.all || 0) : (counts[c.key] || 0);
            const on = channel === c.key;
            return (
              <button key={c.key} onClick={function () { setChannel(c.key); }} style={Object.assign({}, S.tab, on ? S.tabOn : {})}>
                <span>{c.icon + ' ' + c.label}</span>
                <span style={S.tabN}>{n}</span>
              </button>
            );
          })}
        </div>
        <div style={S.scroll}>
          {loading ? <div style={S.empty}>Loading…</div> : null}
          {!loading && convos.length === 0 ? <div style={S.empty}>No conversations here yet.</div> : null}
          {convos.map(function (cv: any) {
            const on = active && active.conversation_id === cv.conversation_id;
            return (
              <div key={cv.conversation_id} onClick={function () { openConv(cv); }} style={Object.assign({}, S.item, on ? S.itemOn : {})}>
                <div style={S.itemTop}>
                  <span style={S.itemName}>{iconFor(cv.channel) + ' ' + cv.name}</span>
                  {cv.has_draft ? <span style={S.draftBadge}>DRAFT</span> : null}
                </div>
                <div style={S.itemPrev}>{cv.last_preview || '—'}</div>
                <div style={S.itemMeta}>{(cv.phone || cv.email || '') + (cv.city ? ' · ' + cv.city : '')}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.thread}>
        {composing ? (
          <div style={S.composeWrap}>
            <div style={S.tHead}><div style={S.tName}>New message</div></div>
            <div style={S.composeBody}>
              <div style={S.cRow}>
                {[{k:'sms',l:'SMS'},{k:'email',l:'Email'},{k:'whatsapp',l:'WhatsApp'}].map(function(o:any){
                  const on=cChannel===o.k;
                  return <button key={o.k} onClick={function(){setCChannel(o.k);}} style={Object.assign({},S.chBtn,on?S.chBtnOn:{})}>{o.l}</button>;
                })}
              </div>
              <input value={cQuery} onChange={function(e:any){searchContacts(e.target.value);}} placeholder="Search a contact by name, phone, email…" style={S.subjInput} />
              {cContact ? (
                <div style={S.picked}>{'To: ' + cContact.name + ' · ' + (cChannel==='email'?(cContact.email||'no email'):(cContact.phone||'no phone'))}<span onClick={function(){setCContact(null);}} style={S.clearX}>✕</span></div>
              ) : (
                <div style={S.results}>
                  {cResults.map(function(r:any){
                    return <div key={r.id} onClick={function(){setCContact(r);setCResults([]);}} style={S.resItem}>{r.name + ' · ' + (r.phone||r.email||'')}</div>;
                  })}
                </div>
              )}
              {cChannel==='email' ? <input value={cSubject} onChange={function(e:any){setCSubject(e.target.value);}} placeholder="Subject" style={S.subjInput} /> : null}
              <textarea value={cBody} onChange={function(e:any){setCBody(e.target.value);}} placeholder={'Write your ' + cChannel + ' message…'} style={S.taBig} />
              <div style={S.composerRow}>
                <button onClick={function(){setComposing(false);}} style={S.cancelBtn}>Cancel</button>
                <button onClick={sendNew} disabled={sending||!cContact||!cBody.trim()} style={Object.assign({},S.send,(sending||!cContact||!cBody.trim())?S.sendOff:{})}>{sending?'Sending…':'Send'}</button>
              </div>
            </div>
          </div>
        ) : !active ? (
          <div style={S.placeholder}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'🛰️'}</div>
            <div style={{ fontSize: 16, color: '#9a93a8' }}>Select a conversation, or hit + New.</div>
            <div style={{ fontSize: 13, color: '#665f73', marginTop: 6 }}>Your drafted SMS are waiting — tap one, edit, send.</div>
          </div>
        ) : (
          <>
            <div style={S.tHead}>
              <div><div style={S.tName}>{iconFor(active.channel) + ' ' + active.name}</div><div style={S.tMeta}>{active.phone || active.email || ''}</div></div>
              <a href={active.phone ? 'tel:' + active.phone : '#'} style={S.callBtn}>Call</a>
            </div>
            <div style={S.msgs}>
              {!thread ? <div style={S.empty}>Loading…</div> : null}
              {thread && (thread.messages || []).map(function (m: any) {
                const out = m.direction === 'out'; const isDraft = m.status === 'draft';
                return (
                  <div key={m.id} style={Object.assign({}, S.bubbleRow, { justifyContent: out ? 'flex-end' : 'flex-start' })}>
                    <div style={Object.assign({}, S.bubble, out ? S.bubbleOut : S.bubbleIn, isDraft ? S.bubbleDraft : {})}>
                      {isDraft ? <div style={S.draftTag}>DRAFT</div> : null}
                      <div style={S.bubbleBody}>{m.body}</div>
                      <div style={S.bubbleTime}>{isDraft ? 'Not sent yet' : (m.status + ' · ' + new Date(m.created_at).toLocaleString())}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={S.composer}>
              {active.channel === 'email' ? <input value={subject} onChange={function (e: any) { setSubject(e.target.value); }} placeholder="Subject" style={S.subjInput} /> : null}
              <textarea value={draft} onChange={function (e: any) { setDraft(e.target.value); }} placeholder={'Write a ' + active.channel + ' message…'} style={S.ta} />
              <div style={S.composerRow}>
                <span style={S.composerHint}>{active.channel === 'sms' ? 'Sends via Twilio' : active.channel === 'whatsapp' ? 'Sends via Twilio WhatsApp' : 'Sends via Resend'}</span>
                <button onClick={sendDraft} disabled={sending || !draft.trim()} style={Object.assign({}, S.send, (sending || !draft.trim()) ? S.sendOff : {})}>{sending ? 'Sending…' : 'Send'}</button>
              </div>
            </div>
          </>
        )}
      </div>
      {toast ? <div style={S.toast}>{toast}</div> : null}
    </div>
  );
}

const S: any = {
  wrap: { display: 'flex', height: '100vh', background: '#08060d', color: '#eceaf4', fontFamily: 'system-ui, sans-serif' },
  list: { width: 340, minWidth: 300, borderRight: '1px solid #241620', display: 'flex', flexDirection: 'column', background: '#0b0810' },
  head: { padding: '14px 16px 8px' },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.15em', fontSize: 14, color: '#e8303a' },
  newBtn: { background: 'linear-gradient(180deg,#e8303a,#a4131c)', border: 'none', borderRadius: 7, color: '#fff', padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
  sub: { display: 'block', fontSize: 11, color: '#665f73', marginTop: 6 },
  tabs: { display: 'flex', gap: 4, padding: '4px 10px 10px', flexWrap: 'wrap' },
  tab: { flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: '#120c16', border: '1px solid #2c1c26', borderRadius: 8, padding: '6px 4px', color: '#9a93a8', cursor: 'pointer', fontSize: 11 },
  tabOn: { borderColor: '#e8303a', color: '#fff', background: '#1a0e14' },
  tabN: { fontSize: 10, color: '#665f73' },
  scroll: { flex: 1, overflowY: 'auto' },
  empty: { padding: 20, color: '#665f73', fontSize: 13, textAlign: 'center' },
  item: { padding: '10px 14px', borderBottom: '1px solid #160f1c', cursor: 'pointer' },
  itemOn: { background: '#1a0e14' },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  draftBadge: { fontSize: 9, fontWeight: 700, color: '#f4b942', border: '1px solid #5a4520', borderRadius: 4, padding: '1px 5px', flex: '0 0 auto' },
  itemPrev: { fontSize: 12, color: '#9a93a8', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemMeta: { fontSize: 11, color: '#665f73', marginTop: 3 },
  thread: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  placeholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  tHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #241620' },
  tName: { fontSize: 15, fontWeight: 600 }, tMeta: { fontSize: 12, color: '#665f73', marginTop: 2 },
  callBtn: { background: '#120c16', border: '1px solid #2c1c26', borderRadius: 8, padding: '8px 16px', color: '#37e0c5', textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  msgs: { flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 },
  bubbleRow: { display: 'flex' },
  bubble: { maxWidth: '72%', padding: '10px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5 },
  bubbleOut: { background: '#2a1620', border: '1px solid #3a2030' },
  bubbleIn: { background: '#141019', border: '1px solid #241620' },
  bubbleDraft: { background: '#1c1408', border: '1px dashed #5a4520' },
  draftTag: { fontSize: 9, fontWeight: 700, color: '#f4b942', marginBottom: 4, letterSpacing: '0.1em' },
  bubbleBody: { whiteSpace: 'pre-wrap' }, bubbleTime: { fontSize: 10, color: '#665f73', marginTop: 5 },
  composer: { borderTop: '1px solid #241620', padding: 12, background: '#0b0810' },
  composeWrap: { flex: 1, display: 'flex', flexDirection: 'column' },
  composeBody: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' },
  cRow: { display: 'flex', gap: 6 },
  chBtn: { flex: 1, background: '#120c16', border: '1px solid #2c1c26', borderRadius: 8, padding: '8px', color: '#9a93a8', cursor: 'pointer', fontSize: 13 },
  chBtnOn: { borderColor: '#e8303a', color: '#fff', background: '#1a0e14' },
  results: { maxHeight: 180, overflowY: 'auto', border: '1px solid #241620', borderRadius: 8 },
  resItem: { padding: '9px 12px', borderBottom: '1px solid #160f1c', cursor: 'pointer', fontSize: 13 },
  picked: { background: '#1a0e14', border: '1px solid #2c1c26', borderRadius: 8, padding: '9px 12px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  clearX: { color: '#e8303a', cursor: 'pointer', marginLeft: 10 },
  subjInput: { width: '100%', background: '#0a0710', border: '1px solid #2c1c26', borderRadius: 8, color: '#eceaf4', padding: 10, fontSize: 13 },
  ta: { width: '100%', minHeight: 70, background: '#0a0710', border: '1px solid #2c1c26', borderRadius: 8, color: '#eceaf4', padding: 11, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' },
  taBig: { width: '100%', minHeight: 140, background: '#0a0710', border: '1px solid #2c1c26', borderRadius: 8, color: '#eceaf4', padding: 11, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' },
  composerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  composerHint: { fontSize: 11, color: '#665f73' },
  cancelBtn: { background: 'transparent', border: '1px solid #2c1c26', borderRadius: 8, color: '#9a93a8', padding: '10px 18px', fontSize: 14, cursor: 'pointer' },
  send: { background: 'linear-gradient(180deg,#e8303a,#a4131c)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  sendOff: { filter: 'grayscale(0.6) brightness(0.7)', cursor: 'not-allowed' },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a0e14', border: '1px solid #e8303a', borderRadius: 8, padding: '10px 20px', color: '#fff', fontSize: 13, zIndex: 50 },
};
