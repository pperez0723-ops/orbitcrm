'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';

// ─── Types ──────────────────────────────────────────────────────────────────
type TLine = { id: number; cls: string; text: string; pre?: string };

// ─── Agent roster ────────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'astra', name: 'ASTRA', role: 'Lead-Gen Scout', color: '#36d399', emoji: '🔍',
    task: 'Find & create 10 local businesses that need a website',
    btn: 'GENERATE LEADS',
    defaultPrompt: 'Find 10 real local businesses that could benefit from a website. For each one, call create_contact with their real business name, a plausible phone number, company name, source set to cold_outreach, and stage set to New Lead. Be creative but realistic — use real business types like plumbers, restaurants, landscapers, dentists. Create all 10 contacts now.',
  },
  {
    id: 'rex', name: 'REX', role: 'SMS Outreach', color: '#f4b942', emoji: '📱',
    task: 'Draft a personalized SMS for each contact in the pipeline',
    btn: 'DRAFT SMS',
    defaultPrompt: 'Search for contacts using search_contacts. For each contact found, draft a personalized SMS intro message under 160 chars that mentions their business name and offers a free website quote. Update each contact using update_contact to save the SMS in their notes field as SMS: [message] and update their stage to SMS Drafted. Cover all contacts.',
  },
  {
    id: 'nova', name: 'NOVA', role: 'Mission Commander', color: '#00e5ff', emoji: '⚡',
    task: 'Plan & coordinate the full outreach campaign',
    btn: 'RUN CAMPAIGN',
    defaultPrompt: 'Run a complete outreach campaign: 1) Use search_contacts to audit the current pipeline and count leads by stage. 2) Create a follow-up task for contacts in New Lead stage using create_task. 3) Create a welcome automation using create_automation. Report stats at each step.',
  },
  {
    id: 'orion', name: 'ORION', role: 'Pipeline Builder', color: '#a78bfa', emoji: '🚀',
    task: 'Create deals and advance contacts through the pipeline',
    btn: 'BUILD PIPELINE',
    defaultPrompt: 'Search for all contacts using search_contacts. For contacts past New Lead stage, create a deal using create_deal with a realistic value between 500 and 5000 dollars based on their business type. Set the title to Website for [company name]. Create a task for each deal.',
  },
  {
    id: 'luna', name: 'LUNA', role: 'Follow-Up Specialist', color: '#f472b6', emoji: '📅',
    task: 'Schedule follow-up tasks for every contact',
    btn: 'SCHEDULE TASKS',
    defaultPrompt: 'Use search_contacts to get all contacts. For each contact, create a follow-up task using create_task: title Follow up with [name], priority based on stage where hot gets high and new gets medium. Also create an automation that triggers on stage_changed to notify the team. Cover every contact.',
  },
  {
    id: 'vera', name: 'VERA', role: 'Analytics & Reports', color: '#fb923c', emoji: '📊',
    task: 'Analyze pipeline, score leads, generate full report',
    btn: 'RUN ANALYSIS',
    defaultPrompt: 'Use search_contacts to get all contacts. Analyze the pipeline: count by stage, identify highest-value prospects, find contacts with no follow-up and create tasks for them using create_task with priority high. Give a full report: total contacts, breakdown by stage, top leads, and recommended next actions.',
  },
] as const;

type AgentId = typeof AGENTS[number]['id'];

// ─── SSE stream helper ────────────────────────────────────────────────────────
async function streamCrew(
  prompt: string,
  onToken: (text: string, cls: string) => void,
  onDone: () => void,
  signal: AbortSignal,
) {
  try {
    const res = await fetch('/api/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
      signal,
    });
    if (!res.ok || !res.body) {
      onToken('Error ' + res.status + ': ' + res.statusText, 'ba');
      onDone();
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const raw = part.replace(/^data:\s*/, '').trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const j = JSON.parse(raw) as Record<string, unknown>;
          const type = typeof j.type === 'string' ? j.type : '';
          let text = '';
          if (typeof j.text === 'string') text = j.text;
          else if (j.delta && typeof (j.delta as Record<string,unknown>).text === 'string')
            text = (j.delta as Record<string,unknown>).text as string;
          else if (typeof j.content === 'string') text = j.content;
          else if (typeof j.message === 'string') text = j.message;
          if (type === 'tool_use' && typeof j.name === 'string') {
            onToken('[' + j.name + '] ', 'in');
          } else if (text) {
            onToken(text, type === 'tool_result' ? 'ok' : 'mu');
          }
        } catch {
          if (raw.length > 2) onToken(raw, 'mu');
        }
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name !== 'AbortError')
      onToken('✗ ' + e.message, 'ba');
  }
  onDone();
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: typeof AGENTS[number] }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [lines, setLines] = useState<TLine[]>([]);
  const [customCmd, setCustomCmd] = useState('');
  const termRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((text: string, cls = 'mu', pre?: string) => {
    setLines(prev => [...prev.slice(-150), { id: idRef.current++, cls, text, pre }]);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const run = useCallback(() => {
    if (busy) { abortRef.current?.abort(); setBusy(false); push('— stopped —', 'wa'); return; }
    setBusy(true);
    setLines([]);
    setDone(0);
    abortRef.current = new AbortController();
    const cmd = customCmd.trim() || agent.defaultPrompt;
    push((customCmd.trim() || agent.task), 'cm', 'orbit ❯ ');
    let actions = 0;
    streamCrew(
      'You are ' + agent.name + ', ' + agent.role + ' for OrbitCRM. ' + cmd,
      (text, cls) => {
        if (cls === 'in') { actions++; setDone(actions); }
        push(text, cls);
      },
      () => {
        setBusy(false);
        push('✔ Done — ' + actions + ' action' + (actions !== 1 ? 's' : '') + ' taken', 'ok');
      },
      abortRef.current.signal,
    );
  }, [busy, agent, customCmd, push]);

  return (
    <div className="agent-card" style={{ borderColor: agent.color + '44' }}>
      <div className="agent-hd" style={{ borderBottomColor: agent.color + '22' }}>
        <div className="agent-av" style={{ background: agent.color + '18', borderColor: agent.color + '55' }}>
          {agent.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div className="agent-name" style={{ color: agent.color }}>{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {done > 0 && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: agent.color }}>{done}✓</span>}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            background: busy ? agent.color : done > 0 ? '#36d399' : '#1a3a5a',
            animation: busy ? 'led 0.7s steps(1) infinite' : 'none',
          }} />
        </div>
      </div>
      <div className="agent-task">{agent.task}</div>
      <div className="agent-row">
        <input
          className="agent-inp"
          value={customCmd}
          onChange={e => setCustomCmd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run(); }}
          placeholder="Override mission..."
        />
        <button
          className="agent-btn"
          onClick={run}
          style={{
            background: busy
              ? 'linear-gradient(180deg,#4a2000,#2a1000)'
              : 'linear-gradient(180deg,' + agent.color + 'cc,' + agent.color + '66)',
            boxShadow: busy ? 'none' : '0 0 10px ' + agent.color + '44',
          }}
        >
          {busy ? '■ STOP' : agent.btn}
        </button>
      </div>
      <div className="agent-term" ref={termRef}>
        {lines.length === 0 ? (
          <span className="idle-msg">Ready — press {agent.btn}</span>
        ) : (
          lines.map(l => (
            <div key={l.id} className={'aln ' + l.cls}>
              {l.pre && <span className="pr">{l.pre}</span>}{l.text}
            </div>
          ))
        )}
        {busy && <div className="aln mu">▌</div>}
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const [contacts, setContacts] = useState(0);
  const [sms, setSms] = useState(0);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const h = String(n.getUTCHours()).padStart(2,'0');
      const m = String(n.getUTCMinutes()).padStart(2,'0');
      const s = String(n.getUTCSeconds()).padStart(2,'0');
      setClock(h + ':' + m + ':' + s + ' UTC');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      const { count: c } = await sb.from('contacts').select('*', { count: 'exact', head: true });
      const { count: s } = await sb.from('contacts').select('*', { count: 'exact', head: true })
        .or('stage.ilike.%sms%,notes.ilike.%SMS:%');
      setContacts(c ?? 0);
      setSms(s ?? 0);
    };
    load().catch(() => null);
    const t = setInterval(() => load().catch(() => null), 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="topbar">
      <div>
        <div className="tl">△ ORBIT CREW HQ</div>
        <div className="ts">REAL AGENTS · REAL ACTIONS · LIVE SUPABASE</div>
      </div>
      <div className="tr">
        <span><b style={{ color: '#00e5ff' }}>{contacts}</b> Contacts</span>
        <span><b style={{ color: '#36d399' }}>{sms}</b> SMS Ready</span>
        <span style={{ color: '#00e5ff', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{clock}</span>
      </div>
    </div>
  );
}

// ─── Global terminal ──────────────────────────────────────────────────────────
function GlobalTerminal() {
  const [lines, setLines] = useState<TLine[]>([
    { id: 0, cls: 'mu', text: 'Orbit Crew HQ online — 6 agents ready to deploy.' },
    { id: 1, cls: 'mu', text: 'Type an order below or use a chip. The right agent auto-deploys.' },
  ]);
  const [cmd, setCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);
  const abortRef = useRef<AbortController | null>(null);

  const push = (text: string, cls = 'mu', pre?: string) => {
    setLines(prev => [...prev.slice(-250), { id: idRef.current++, cls, text, pre }]);
  };

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const dispatch = useCallback(async (command: string) => {
    if (!command.trim()) return;
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    setBusy(true);
    setCmd('');
    abortRef.current = new AbortController();
    push(command, 'cm', 'orbit ❯ ');

    const lower = command.toLowerCase();
    let agentId: AgentId = 'nova';
    if (lower.includes('lead') || lower.includes('prospect') || lower.includes('find') || lower.includes('business')) agentId = 'astra';
    else if (lower.includes('sms') || lower.includes('message') || lower.includes('text') || lower.includes('draft')) agentId = 'rex';
    else if (lower.includes('deal') || lower.includes('pipeline') || lower.includes('stage') || lower.includes('close')) agentId = 'orion';
    else if (lower.includes('task') || lower.includes('follow') || lower.includes('schedule')) agentId = 'luna';
    else if (lower.includes('report') || lower.includes('analyz') || lower.includes('stats')) agentId = 'vera';

    const agent = AGENTS.find(a => a.id === agentId) ?? AGENTS[0];
    push('Deploying ' + agent.name + ' (' + agent.role + ')…', 'in');

    await streamCrew(
      'You are ' + agent.name + ', ' + agent.role + ' for OrbitCRM. ' + command,
      (text, cls) => push(text, cls),
      () => { setBusy(false); push('', 'cm', 'orbit ❯ '); },
      abortRef.current.signal,
    );
  }, [busy]);

  const CHIPS = [
    'Find 10 businesses that need websites',
    'Draft SMS for all contacts',
    'Create deals for every lead',
    'Schedule follow-ups for everyone',
    'Run full pipeline analysis',
  ];

  return (
    <div className="gterm">
      <div className="tbar">
        <div className="dots"><i style={{ background: '#ff5f57' }}/><i style={{ background: '#febc2e' }}/><i style={{ background: '#28c840' }}/></div>
        <span className="tlbl">ORBIT@CREW ~/ORBITCRM — MISSION DISPATCH</span>
        {busy && <span className="tlbl" style={{ color: '#f4b942', marginLeft: 'auto' }}>● RUNNING</span>}
      </div>
      <div className="gbody" ref={termRef}>
        {lines.map(l => (
          <div key={l.id} className={'gln ' + l.cls}>
            {l.pre && <span className="pr">{l.pre}</span>}
            {l.text}
            {l.pre && !l.text && !busy && <span className="cur" />}
          </div>
        ))}
        {busy && <div className="gln mu"><span className="cur" /></div>}
      </div>
      <div className="gctrl">
        <div className="crow">
          <input
            className="cinp"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void dispatch(cmd); }}
            placeholder="e.g. Find 10 businesses that need websites in Miami..."
          />
          <button className="rbtn" onClick={() => void dispatch(cmd)} disabled={!cmd.trim() && !busy}>
            {busy ? '■ STOP' : 'DISPATCH'}
          </button>
        </div>
        <div className="chips">
          {CHIPS.map(c => (
            <button key={c} className="chip" onClick={() => void dispatch(c)}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CrewPage() {
  return (
    <div className="crew-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        :root{--bg:#030a12;--hull:#05101e;--panel:#071628;--teal:#00e5ff;--green:#36d399;--red:#e8303a;--rs:#ff5d66;--amber:#f4b942;--ink:#dff0ff;--dim:#5a8aaa;--faint:#2a4a6a;}
        .crew-page{background:var(--bg);color:var(--ink);font-family:'Orbitron',monospace;min-height:100vh;padding:10px 14px 32px;max-width:1400px;margin:0 auto;}
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 18px;background:linear-gradient(180deg,#0a1e36,#040e1c);border:1px solid #0e2840;margin-bottom:12px;border-radius:8px;}
        .tl{font-size:16px;font-weight:900;letter-spacing:.15em;color:var(--teal);text-shadow:0 0 16px #00e5ff88;}
        .ts{font-size:7px;letter-spacing:.2em;color:var(--dim);margin-top:2px;}
        .tr{display:flex;gap:18px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;}
        .section-hd{font-size:7px;letter-spacing:.25em;color:var(--faint);text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #0e2840;}
        .agents-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;}
        @media(max-width:1000px){.agents-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:600px){.agents-grid{grid-template-columns:1fr;}}
        .agent-card{background:var(--hull);border:1px solid #0e2840;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;}
        .agent-hd{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #0e2840;}
        .agent-av{width:38px;height:38px;border-radius:7px;border:1px solid;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
        .agent-name{font-size:12px;font-weight:900;letter-spacing:.12em;}
        .agent-role{font-size:8px;color:var(--dim);letter-spacing:.1em;text-transform:uppercase;margin-top:2px;}
        .agent-task{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--dim);padding:7px 12px;line-height:1.5;min-height:40px;}
        .agent-row{display:flex;gap:6px;padding:0 8px 8px;}
        .agent-inp{flex:1;background:#020b18;border:1px solid #0e2840;border-radius:5px;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 9px;}
        .agent-inp:focus{outline:none;border-color:var(--teal);}
        .agent-inp::placeholder{color:var(--faint);}
        .agent-btn{border:none;border-radius:5px;padding:6px 10px;color:#000;font-family:'Orbitron',monospace;font-size:7px;font-weight:900;letter-spacing:.08em;cursor:pointer;}
        .agent-term{flex:1;min-height:130px;max-height:200px;overflow-y:auto;padding:7px 10px;background:#020910;border-top:1px solid #0a1e30;font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.65;}
        .agent-term::-webkit-scrollbar{width:3px;}.agent-term::-webkit-scrollbar-thumb{background:#0e2840;}
        .idle-msg{color:var(--faint);font-style:italic;}
        .aln{white-space:pre-wrap;word-break:break-word;}
        .aln.cm,.gln.cm{color:var(--ink);}.aln.ok,.gln.ok{color:var(--green);}.aln.in,.gln.in{color:var(--teal);}.aln.mu,.gln.mu{color:var(--dim);}.aln.ba,.gln.ba{color:var(--red);}.aln.wa,.gln.wa{color:var(--amber);}
        @keyframes led{50%{opacity:.15;}}
        .gterm{background:#020910;border:1px solid #0e2840;border-radius:8px;overflow:hidden;margin-bottom:10px;}
        .tbar{display:flex;align-items:center;gap:7px;padding:7px 12px;background:#030d1c;border-bottom:1px solid #0e2840;}
        .dots{display:flex;gap:5px;}.dots i{width:9px;height:9px;border-radius:50%;display:block;}
        .tlbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.13em;color:var(--faint);text-transform:uppercase;}
        .gbody{height:170px;overflow-y:auto;padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.7;}
        .gbody::-webkit-scrollbar{width:4px;}.gbody::-webkit-scrollbar-thumb{background:#0e2840;}
        .gln{display:flex;gap:5px;white-space:pre-wrap;word-break:break-word;}
        .pr{color:var(--rs);flex-shrink:0;}
        .cur{display:inline-block;width:6px;height:12px;background:var(--red);vertical-align:-2px;animation:cu 1s steps(1) infinite;}
        @keyframes cu{50%{opacity:0;}}
        .gctrl{padding:10px 12px 12px;background:var(--hull);border-top:1px solid #0e2840;}
        .crow{display:flex;gap:8px;}
        .cinp{flex:1;background:#020b18;border:1px solid #0e2840;border-radius:6px;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px 13px;}
        .cinp:focus{outline:none;border-color:var(--teal);}
        .cinp::placeholder{color:var(--faint);}
        .rbtn{background:linear-gradient(180deg,#d42030,#8a0f18);border:none;border-radius:6px;padding:0 18px;color:#fff;font-family:'Orbitron',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;cursor:pointer;height:44px;}
        .rbtn:disabled{filter:grayscale(.7);cursor:not-allowed;}
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
        .chip{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);background:#030c1c;border:1px solid #0e2840;border-radius:4px;padding:5px 10px;cursor:pointer;}
        .chip:hover{border-color:var(--teal);color:var(--ink);}
      `}</style>

      <StatsBar />

      <div className="section-hd">⚡ Individual agents — each runs a real Claude-powered mission on your live CRM</div>

      <div className="agents-grid">
        {AGENTS.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      <div className="section-hd">📡 Mission dispatch — describe what you need, right agent auto-deploys</div>

      <GlobalTerminal />

      <div style={{ textAlign: 'center', marginTop: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: '.15em', color: 'var(--faint)', textTransform: 'uppercase' }}>
        ORBIT CREW HQ · REAL WORKERS · CLAUDE SONNET 4.6 · LIVE SUPABASE
      </div>
    </div>
  );
}
