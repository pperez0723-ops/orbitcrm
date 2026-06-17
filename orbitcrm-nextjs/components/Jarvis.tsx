'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const SUPABASE_URL = 'https://jlbnieorltkfezixulxc.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYm5pZW9ybHRrZmV6aXh1bHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjEzMzgsImV4cCI6MjA5NTU5NzMzOH0.btksRPHzGDpyzCmXhrzDusnd-OI7-xIcjN3CV_XZQys';
const FN = SUPABASE_URL + '/functions/v1/claude-chat';
const REST = SUPABASE_URL + '/rest/v1';

type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

function getAuthToken(): string {
  try {
    for (const k in localStorage) {
      if (k.includes('auth-token')) {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v?.access_token) return v.access_token;
      }
    }
  } catch {}
  return ANON_KEY;
}

async function sb(path: string, init: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(REST + path, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function getWorkspaceId(): Promise<string | null> {
  try {
    const rows = await sb('/workspace_members?select=workspace_id&limit=1');
    return rows?.[0]?.workspace_id || null;
  } catch {
    return null;
  }
}

async function pingCRM(): Promise<boolean> {
  try {
    const rows = await sb('/workspace_members?select=workspace_id&limit=1');
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

const TOOLS = [
  { name: 'create_contact', description: 'Create a new contact/lead.', input_schema: { type: 'object', properties: { fname: { type: 'string' }, lname: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, company: { type: 'string' } }, required: ['fname'] } },
  { name: 'search_contacts', description: 'Search contacts by name/company/email.', input_schema: { type: 'object', properties: { query: { type: 'string' } } } },
  { name: 'count_contacts', description: 'How many contacts exist.', input_schema: { type: 'object', properties: {} } },
  { name: 'pipeline_summary', description: 'Deals/value grouped by stage.', input_schema: { type: 'object', properties: {} } },
  { name: 'best_lead', description: 'Highest-scoring contact.', input_schema: { type: 'object', properties: {} } },
];

async function runTool(ws: string, name: string, a: Record<string, unknown>) {
  try {
    if (name === 'create_contact') {
      await sb('/contacts', { method: 'POST', body: JSON.stringify({ workspace_id: ws, fname: a.fname, lname: a.lname || null, email: a.email || null, phone: a.phone || null, company: a.company || null, source: 'other' }) });
      return { ok: true, label: `created ${a.fname}` };
    }
    if (name === 'search_contacts') {
      const q = encodeURIComponent(`%${a.query || ''}%`);
      const rows = await sb(`/contacts?select=fname,lname,company,score&or=(fname.ilike.${q},lname.ilike.${q},company.ilike.${q})&limit=8`);
      return { ok: true, results: (rows || []).map((c: Record<string,unknown>) => `${c.fname} ${c.lname || ''} ${c.company ? '(' + c.company + ')' : ''} score ${c.score ?? 0}`) };
    }
    if (name === 'count_contacts') {
      const rows = await sb('/contacts?select=id');
      return { ok: true, count: (rows || []).length };
    }
    if (name === 'pipeline_summary') {
      const stages = await sb('/stages?select=id,name');
      const deals = await sb('/deals?select=stage_id,value');
      const byStage = (stages || []).map((s: Record<string,unknown>) => {
        const ds = (deals || []).filter((d: Record<string,unknown>) => d.stage_id === s.id);
        return { stage: s.name, count: ds.length, value: ds.reduce((x: number, d: Record<string,unknown>) => x + Number(d.value || 0), 0) };
      });
      return { ok: true, byStage, total: (deals || []).reduce((x: number, d: Record<string,unknown>) => x + Number(d.value || 0), 0) };
    }
    if (name === 'best_lead') {
      const rows = await sb('/contacts?select=fname,lname,company,score&order=score.desc&limit=1');
      const b = rows?.[0];
      return { ok: true, lead: b ? `${b.fname} ${b.lname || ''} (${b.company || '—'}, score ${b.score ?? 0})` : 'none yet' };
    }
    return { error: 'unknown tool' };
  } catch (e: unknown) {
    return { error: String(e instanceof Error ? e.message : e) };
  }
}

async function callClaude(messages: unknown[]) {
  const sys = 'You are JARVIS, the orbital intelligence inside OrbitCRM — a witty, composed British AI like Iron Man\'s JARVIS. Address the user as "sir" occasionally, stay concise and cool. Operate the CRM with your tools, then confirm in ONE short spoken sentence. Replies are read aloud, so no markdown or lists — keep it brief and natural.';
  const token = getAuthToken();
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: ANON_KEY },
    body: JSON.stringify({ system: sys, messages, max_tokens: 1000, tools: TOOLS, model: 'claude-sonnet-4-6' }),
  });
  if (!res.ok) throw new Error(`Edge function error: ${res.status}`);
  return res.json();
}

export default function Jarvis() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const wsRef = useRef<string | null>(null);
  const histRef = useRef<unknown[]>([]);
  const recogRef = useRef<unknown>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    (async () => {
      const ok = await pingCRM();
      setConnected(ok);
      if (ok) {
        const id = await getWorkspaceId();
        wsRef.current = id;
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setConnected(null);
      const ok = await pingCRM();
      setConnected(ok);
      if (ok && !wsRef.current) {
        const id = await getWorkspaceId();
        wsRef.current = id;
      }
    })();
  }, [open]);

  const speak = useCallback((text: string) => {
    setReply(text);
    if (!('speechSynthesis' in window)) { setMode('idle'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 0.92;
    const vs = speechSynthesis.getVoices();
    const brit = vs.find((v) => /Daniel|Google UK English Male|Arthur|en-GB/.test(v.name + v.lang)) || vs.find((v) => v.lang.startsWith('en'));
    if (brit) u.voice = brit;
    setMode('speaking');
    u.onend = () => setMode('idle');
    u.onerror = () => setMode('idle');
    speechSynthesis.speak(u);
  }, []);

  const handle = useCallback(async (text: string) => {
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setTranscript(text); setMode('thinking');
    let ws = wsRef.current;
    if (!ws) { ws = await getWorkspaceId(); wsRef.current = ws; }
    if (!ws) {
      speak('I cannot reach the CRM database, sir. Please check your connection.');
      busyRef.current = false;
      return;
    }
    histRef.current.push({ role: 'user', content: text });
    try {
      let convo = [...histRef.current];
      let final = '';
      for (let i = 0; i < 5; i++) {
        const d = await callClaude(convo) as Record<string, unknown>;
        if (d.error) { final = 'I hit a system error, sir.'; break; }
        const content = (d.content || []) as Record<string, unknown>[];
        const tools = content.filter((b) => b.type === 'tool_use');
        const texts = content.filter((b) => b.type === 'text').map((b) => b.text as string);
        if (texts.length) final = texts.join(' ');
        if (!tools.length || d.stop_reason !== 'tool_use') break;
        convo.push({ role: 'assistant', content: d.content });
        const results: unknown[] = [];
        for (const t of tools) results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(await runTool(ws, t.name as string, t.input as Record<string, unknown>)) });
        convo.push({ role: 'user', content: results });
      }
      histRef.current.push({ role: 'assistant', content: final });
      speak(final || 'Done, sir.');
    } catch {
      speak('I lost the connection to the CRM, sir. Please try again.');
    } finally {
      busyRef.current = false;
    }
  }, [speak]);

  const listen = useCallback(() => {
    const win = window as unknown as Record<string, unknown>;
    const SR = (win.SpeechRecognition || win.webkitSpeechRecognition) as (new () => unknown) | undefined;
    if (!SR) { speak('Voice input needs Chrome, sir.'); return; }
    if (mode === 'listening') { (recogRef.current as {stop:()=>void} | null)?.stop(); setMode('idle'); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const r = new SR() as Record<string, unknown>;
    r.lang = 'en-US'; r.interimResults = false; r.continuous = false;
    r.onresult = (e: unknown) => {
      const ev = e as {results:{[i:number]:{[j:number]:{transcript:string}}}};
      const t = ev.results[0][0].transcript.trim();
      if (t) handle(t);
    };
    r.onend = () => { setMode((m) => (m === 'listening' ? 'idle' : m)); };
    r.onerror = (ev: unknown) => {
      setMode('idle');
      const e = ev as {error?: string};
      if (e.error === 'not-allowed') speak('I need microphone permission, sir.');
    };
    recogRef.current = r;
    setMode('listening'); setTranscript('');
    try { (r.start as () => void)(); } catch {}
  }, [mode, handle, speak]);

  const ringColor = mode === 'listening' ? '#2DD4BF' : mode === 'thinking' ? '#F4B942' : '#E8303A';
  const label = mode === 'listening' ? 'Listening…' : mode === 'thinking' ? 'Working…' : mode === 'speaking' ? 'Speaking…' : 'Ready';
  const connDot = connected === null ? '#F4B942' : connected ? '#2DD4BF' : '#E8303A';
  const connText = connected === null ? 'Connecting…' : connected ? 'CRM Connected' : 'CRM Offline';

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, width: 58, height: 58, borderRadius: '50%', background: open ? '#1a1a2e' : 'linear-gradient(135deg,#E8303A,#a0001a)', border: '2px solid rgba(232,48,58,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(232,48,58,0.4)', transition: 'all .2s' }}
        aria-label="Open JARVIS"
      >
        <span style={{ fontSize: 26 }}>{'\uD83E\uDD16'}</span>
      </button>

      {open && (
        <div style={{ position: 'fixed', bottom: 92, right: 22, zIndex: 9999, width: 320, maxWidth: '92vw', background: 'rgba(8,8,20,0.97)', border: '1px solid rgba(232,48,58,0.25)', borderRadius: 18, padding: '18px 16px 16px', boxShadow: '0 8px 40px rgba(0,0,0,.8)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, letterSpacing: 1, fontSize: 16 }}>ASTRO <span style={{ color: '#E8303A' }}>JARVIS</span></div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: connDot, boxShadow: `0 0 6px ${connDot}` }} />
              <span style={{ fontSize: 10, letterSpacing: 1, color: connDot }}>{connText}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 14px' }}>
            <button
              onClick={listen}
              disabled={connected === false}
              style={{ width: 80, height: 80, borderRadius: '50%', cursor: connected === false ? 'not-allowed' : 'pointer', border: `3px solid ${ringColor}`, background: 'radial-gradient(circle at 40% 38%, rgba(255,255,255,0.08), transparent 70%), rgba(15,15,30,0.95)', boxShadow: `0 0 ${mode !== 'idle' ? '28px' : '12px'} ${ringColor}55`, transition: 'all .3s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, outline: 'none' }}
              title={connected === false ? 'CRM offline' : label}
            >
              {'\uD83C\uDF99\uFE0F'}
            </button>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: 1, color: ringColor, marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>

          {transcript && (
            <div style={{ fontSize: 12, color: 'rgba(242,240,250,0.55)', textAlign: 'center', fontStyle: 'italic', marginBottom: 6 }}>
              &ldquo;{transcript}&rdquo;
            </div>
          )}

          {reply && (
            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.5, textAlign: 'center', color: 'rgba(242,240,250,0.9)', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px' }}>{reply}</div>
          )}

          <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(242,240,250,0.28)', textAlign: 'center' }}>
            Try: &ldquo;what&apos;s my pipeline&rdquo; &middot; &ldquo;add contact Maria Lopez&rdquo;
          </div>
        </div>
      )}
    </>
  );
}
