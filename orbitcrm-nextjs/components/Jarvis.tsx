'use client';
// ============================================================================
// Jarvis.tsx — voice assistant for OrbitCRM (drop-in, self-contained)
// Place this file at:  orbitcrm-nextjs/components/Jarvis.tsx
// Then mount it once in: orbitcrm-nextjs/app/dashboard/layout.tsx  (see instructions)
//
// What it does:
//  - Floating mic button on every dashboard page (bottom-right)
//  - Tap to talk (one tap needed — browser rule), speak a command
//  - Sends your speech to the live `claude-chat` Edge Function (already deployed)
//  - JARVIS runs real CRM actions on your Supabase tables, then replies out loud
//  - Reactive states: idle / listening / thinking / speaking
//
// No extra npm installs. Uses the browser's built-in SpeechRecognition +
// SpeechSynthesis, and calls Supabase REST directly with your public anon key
// (safe to expose — protected by RLS).
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

// --- Live backend config (public values, safe in browser) -------------------
const SUPABASE_URL = 'https://jlbnieorltkfezixulxc.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYm5pZW9ybHRrZmV6aXh1bHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjEzMzgsImV4cCI6MjA5NTU5NzMzOH0.btksRPHzGDpyzCmXhrzDusnd-OI7-xIcjN3CV_XZQys';
const FN = SUPABASE_URL + '/functions/v1/claude-chat';
const REST = SUPABASE_URL + '/rest/v1';

type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

// --- helper: authed REST call against your tables ---------------------------
async function sb(path: string, init: RequestInit = {}) {
  // grab the logged-in user's access token if present (so RLS sees the real user)
  let token = ANON_KEY;
  try {
    for (const k in localStorage) {
      if (k.includes('auth-token')) {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v?.access_token) token = v.access_token;
      }
    }
  } catch {}
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

// --- resolve the user's workspace id ----------------------------------------
async function getWorkspaceId(): Promise<string | null> {
  try {
    const rows = await sb('/workspace_members?select=workspace_id&limit=1');
    return rows?.[0]?.workspace_id || null;
  } catch {
    return null;
  }
}

// --- CRM tools JARVIS can call ----------------------------------------------
const TOOLS = [
  { name: 'create_contact', description: 'Create a new contact/lead.', input_schema: { type: 'object', properties: { fname: { type: 'string' }, lname: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, company: { type: 'string' } }, required: ['fname'] } },
  { name: 'search_contacts', description: 'Search contacts by name/company/email.', input_schema: { type: 'object', properties: { query: { type: 'string' } } } },
  { name: 'count_contacts', description: 'How many contacts exist.', input_schema: { type: 'object', properties: {} } },
  { name: 'pipeline_summary', description: 'Deals/value grouped by stage.', input_schema: { type: 'object', properties: {} } },
  { name: 'best_lead', description: 'Highest-scoring contact.', input_schema: { type: 'object', properties: {} } },
];

async function runTool(ws: string, name: string, a: any) {
  try {
    if (name === 'create_contact') {
      await sb('/contacts', { method: 'POST', body: JSON.stringify({ workspace_id: ws, fname: a.fname, lname: a.lname || null, email: a.email || null, phone: a.phone || null, company: a.company || null, source: 'other' }) });
      return { ok: true, label: `created ${a.fname}` };
    }
    if (name === 'search_contacts') {
      const q = encodeURIComponent(`%${a.query || ''}%`);
      const rows = await sb(`/contacts?select=fname,lname,company,score&or=(fname.ilike.${q},lname.ilike.${q},company.ilike.${q})&limit=8`);
      return { ok: true, results: (rows || []).map((c: any) => `${c.fname} ${c.lname || ''} ${c.company ? '(' + c.company + ')' : ''} score ${c.score ?? 0}`) };
    }
    if (name === 'count_contacts') {
      const rows = await sb('/contacts?select=id');
      return { ok: true, count: (rows || []).length };
    }
    if (name === 'pipeline_summary') {
      const stages = await sb('/stages?select=id,name');
      const deals = await sb('/deals?select=stage_id,value');
      const byStage = (stages || []).map((s: any) => {
        const ds = (deals || []).filter((d: any) => d.stage_id === s.id);
        return { stage: s.name, count: ds.length, value: ds.reduce((x: number, d: any) => x + Number(d.value || 0), 0) };
      });
      return { ok: true, byStage, total: (deals || []).reduce((x: number, d: any) => x + Number(d.value || 0), 0) };
    }
    if (name === 'best_lead') {
      const rows = await sb('/contacts?select=fname,lname,company,score&order=score.desc&limit=1');
      const b = rows?.[0];
      return { ok: true, lead: b ? `${b.fname} ${b.lname || ''} (${b.company || '—'}, score ${b.score ?? 0})` : 'none yet' };
    }
    return { error: 'unknown tool' };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

// --- call the live Edge Function (proxies to Claude) ------------------------
async function callClaude(messages: any[]) {
  const sys =
    'You are JARVIS, the orbital intelligence inside OrbitCRM — a witty, composed British AI like Iron Man\'s JARVIS. Address the user as "sir" occasionally, stay concise and cool. Operate the CRM with your tools, then confirm in ONE short spoken sentence. Replies are read aloud, so no markdown or lists — keep it brief and natural.';
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY, apikey: ANON_KEY },
    body: JSON.stringify({ system: sys, messages, max_tokens: 1000, tools: TOOLS, model: 'claude-sonnet-4-6' }),
  });
  return res.json();
}

export default function Jarvis() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const wsRef = useRef<string | null>(null);
  const histRef = useRef<any[]>([]);
  const recogRef = useRef<any>(null);
  const busyRef = useRef(false);

  useEffect(() => { getWorkspaceId().then((id) => (wsRef.current = id)); }, []);

  const speak = useCallback((text: string) => {
    setReply(text);
    if (!('speechSynthesis' in window)) { setMode('idle'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 0.92;
    const vs = speechSynthesis.getVoices();
    const brit = vs.find((v) => /Daniel|Google UK English Male|Arthur|en-GB/.test(v.name + v.lang)) || vs.find((v) => /en-GB/.test(v.lang));
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
    const ws = wsRef.current || (await getWorkspaceId());
    wsRef.current = ws;
    histRef.current.push({ role: 'user', content: text });
    try {
      let convo = [...histRef.current];
      let final = '';
      for (let i = 0; i < 5; i++) {
        const d = await callClaude(convo);
        if (d.error) { final = 'I hit a system error, sir.'; break; }
        const tools = (d.content || []).filter((b: any) => b.type === 'tool_use');
        const texts = (d.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text);
        if (texts.length) final = texts.join(' ');
        if (!tools.length || d.stop_reason !== 'tool_use') break;
        convo.push({ role: 'assistant', content: d.content });
        const results = [];
        for (const t of tools) results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(await runTool(ws || '', t.name, t.input)) });
        convo.push({ role: 'user', content: results });
      }
      histRef.current.push({ role: 'assistant', content: final });
      speak(final);
    } catch {
      speak('I lost the connection, sir.');
    } finally {
      busyRef.current = false;
    }
  }, [speak]);

  const listen = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { speak('Voice input needs Chrome, sir.'); return; }
    if (mode === 'listening') { recogRef.current?.stop(); setMode('idle'); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript.trim(); if (t) handle(t); };
    r.onend = () => { setMode((m) => (m === 'listening' ? 'idle' : m)); };
    r.onerror = (ev: any) => { setMode('idle'); if (ev.error === 'not-allowed') speak('I need microphone permission, sir.'); };
    recogRef.current = r;
    setMode('listening'); setTranscript('');
    try { r.start(); } catch {}
  }, [mode, handle, speak]);

  const ring =
    mode === 'listening' ? '#2DD4BF' : mode === 'thinking' ? '#F4B942' : mode === 'speaking' ? '#E8303A' : '#E8303A';
  const label =
    mode === 'listening' ? 'Listening…' : mode === 'thinking' ? 'Working…' : mode === 'speaking' ? 'Speaking…' : 'Tap & talk';

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'radial-gradient(circle,#E8303A,#8c1118)', color: '#fff', fontSize: 24, boxShadow: '0 0 26px rgba(232,48,58,0.55)' }}
        aria-label="Open JARVIS"
      >🚀</button>

      {open && (
        <div style={{ position: 'fixed', bottom: 92, right: 22, zIndex: 9999, width: 320, maxWidth: '92vw', background: 'rgba(12,12,20,0.96)', border: '1px solid rgba(232,48,58,0.3)', borderRadius: 16, padding: 18, backdropFilter: 'blur(14px)', boxShadow: '0 12px 50px rgba(0,0,0,0.6)', color: '#F2F0FA', fontFamily: 'system-ui,sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, letterSpacing: 1, fontSize: 16 }}>ASTRO <span style={{ color: '#E8303A' }}>· JARVIS</span></div>
            <div style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: 1, color: ring }}>● {label.toUpperCase()}</div>
          </div>

          {/* reactive orb */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 14px' }}>
            <button onClick={listen} style={{ width: 96, height: 96, borderRadius: '50%', cursor: 'pointer', border: `2px solid ${ring}`, background: `radial-gradient(circle, ${ring}33, transparent 70%)`, color: ring, fontSize: 34, boxShadow: `0 0 30px ${ring}66`, transition: 'all .3s' }} aria-label="Talk to JARVIS">🎙️</button>
          </div>

          <div style={{ minHeight: 34, fontSize: 13, color: 'rgba(242,240,250,0.6)', textAlign: 'center', fontStyle: 'italic' }}>
            {transcript ? `"${transcript}"` : 'Tap the mic, then speak'}
          </div>
          {reply && <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.5, textAlign: 'center' }}>{reply}</div>}

          <div style={{ marginTop: 12, fontSize: 10.5, color: 'rgba(242,240,250,0.32)', textAlign: 'center', lineHeight: 1.5 }}>
            Try: "what's my pipeline" · "add contact Maria Lopez" · "who's my best lead"
          </div>
        </div>
      )}
    </>
  );
}
