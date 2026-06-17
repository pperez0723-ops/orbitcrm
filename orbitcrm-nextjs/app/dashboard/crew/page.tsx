'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TLine { id: number; cls: string; text: string; pre?: string; }
interface Contact {
  id: string; name?: string; first_name?: string; last_name?: string;
  email?: string; phone?: string; company?: string; stage?: string;
  notes?: string; sms_draft?: string;
}
interface AgentState {
  id: string; busy: boolean; done: number; lines: TLine[];
}

// ─── Crew roster ────────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'astra', name: 'ASTRA', role: 'Lead-Gen Scout', color: '#36d399', emoji: '🔍',
    task: 'Find & create 10 real local businesses that need a website in your area',
    btn: 'GENERATE LEADS',
    prompt: (cmd: string) =>
      `You are ASTRA, an elite lead-gen agent for OrbitCRM. Your job is to find real local businesses that need websites.
Mission: ${cmd || 'Find 10 real local businesses that could benefit from a website. For each one, call create_contact with their real business name, a plausible local phone number, company name, set source to "cold_outreach", and set stage to "New Lead". Be creative but realistic — use real business types like plumbers, restaurants, landscapers, dentists, etc. Create all 10 contacts now.'}
Execute immediately. Call create_contact for each lead. Stream progress as you go.`,
  },
  {
    id: 'rex', name: 'REX', role: 'SMS Outreach', color: '#f4b942', emoji: '📱',
    task: 'Draft a personalized SMS for each contact in your pipeline',
    btn: 'DRAFT SMS',
    prompt: (cmd: string) =>
      `You are REX, the SMS outreach specialist for OrbitCRM. Your job is to write personalized, high-converting SMS messages.
Mission: ${cmd || 'Search for contacts in the pipeline using search_contacts. For each contact found, draft a personalized SMS intro message (under 160 chars) that mentions their business name and offers a free website quote. Update each contact using update_contact to save the SMS in their notes field as "SMS: [message]". Also update their stage to "SMS Drafted". Be personal and compelling. Do this for all contacts.'}
Execute immediately. Use search_contacts first, then update each one.`,
  },
  {
    id: 'nova', name: 'NOVA', role: 'Mission Commander', color: '#00e5ff', emoji: '⚡',
    task: 'Plan & coordinate the full outreach campaign end-to-end',
    btn: 'RUN CAMPAIGN',
    prompt: (cmd: string) =>
      `You are NOVA, the mission commander for OrbitCRM. You coordinate the full sales pipeline.
Mission: ${cmd || 'Run a complete outreach campaign: 1) Use search_contacts to audit the current pipeline and count leads by stage. 2) Create a follow-up task for each contact that has been in "New Lead" stage for too long using create_task. 3) Create an automation for new contacts to get a welcome SMS using create_automation. Report stats at each step.'}
Execute immediately. Stream your work.`,
  },
  {
    id: 'orion', name: 'ORION', role: 'Pipeline Builder', color: '#a78bfa', emoji: '🚀',
    task: 'Create deals and move contacts through the pipeline',
    btn: 'BUILD PIPELINE',
    prompt: (cmd: string) =>
      `You are ORION, the pipeline builder for OrbitCRM. You create deals and advance contacts.
Mission: ${cmd || 'Search for all contacts using search_contacts. For any contact that does NOT have a deal yet and is past "New Lead" stage, create a deal using create_deal with a realistic value ($500-$5000 based on their business type). Set the title to "Website for [company name]". Create tasks for follow-up on each deal.'}
Execute immediately. Create deals for all qualifying contacts.`,
  },
  {
    id: 'luna', name: 'LUNA', role: 'Follow-Up Specialist', color: '#f472b6', emoji: '📅',
    task: 'Schedule follow-ups and tasks for every contact',
    btn: 'SCHEDULE TASKS',
    prompt: (cmd: string) =>
      `You are LUNA, the follow-up specialist for OrbitCRM. You make sure no lead falls through the cracks.
Mission: ${cmd || 'Use search_contacts to get all contacts. For each contact, create a follow-up task using create_task: title "Follow up with [name]", due_date 3 days from now, priority based on stage (hot=high, new=medium). Also create an automation using create_automation that triggers on stage_changed to send an SMS. Cover every contact.'}
Execute immediately. Create a task for every single contact.`,
  },
  {
    id: 'vera', name: 'VERA', role: 'Analytics & Reports', color: '#fb923c', emoji: '📊',
    task: 'Analyze pipeline, score leads, generate insights',
    btn: 'RUN ANALYSIS',
    prompt: (cmd: string) =>
      `You are VERA, the analytics agent for OrbitCRM. You analyze data and surface insights.
Mission: ${cmd || 'Use search_contacts to get all contacts. Analyze the pipeline: count by stage, identify the highest-value prospects, find contacts with no follow-up tasks (create tasks for them using create_task), flag stale leads. Create tasks for the top 5 hottest leads with priority=high. Give a full report: total contacts, conversion rate estimate, recommended next actions.'}
Execute immediately. Analyze everything and take action.`,
  },
];

// ─── SSE stream reader ───────────────────────────────────────────────────────
async function streamCrew(
  prompt: string,
  onToken: (t: string, cls?: string) => void,
  onDone: () => void,
  signal?: AbortSignal
) {
  try {
    const res = await fetch('/api/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
      signal,
    });
    if (!res.ok || !res.body) {
      onToken('Error: ' + res.status + ' ' + res.statusText, 'ba');
      onDone();
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const raw = part.replace(/^data:\s*/, '').trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const j = JSON.parse(raw);
          // SSE formats: {type, delta/text/content}
          const text =
            j?.delta?.text ??
            j?.text ??
            (Array.isArray(j?.content) ? j.content.map((b: any) => b.text ?? '').join('') : null) ??
            (typeof j?.content === 'string' ? j.content : null) ??
            j?.message ?? '';
          const type = j?.type ?? '';
          if (text) {
            const cls =
              type === 'tool_use' ? 'in' :
              type === 'tool_result' ? 'ok' :
              'mu';
            onToken(text, cls);
          }
          // Tool use events
          if (type === 'tool_use' && j?.name) {
            onToken('[' + j.name + '] ', 'in');
          }
        } catch {
          if (raw.length > 2) onToken(raw, 'mu');
        }
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') onToken('✗ ' + (e.message || String(e)), 'ba');
  }
  onDone();
}

// ─── Individual Agent Component ──────────────────────────────────────────────
function AgentCard({
  agent,
  supabase,
}: {
  agent: typeof AGENTS[0];
  supabase: ReturnType<typeof createClient>;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [lines, setLines] = useState<TLine[]>([]);
  const [customCmd, setCustomCmd] = useState('');
  const termRef = useRef<HTMLDivElement>(null);
  const lineId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const addLine = useCallback((text: string, cls = 'mu', pre?: string) => {
    setLines(prev => [...prev.slice(-120), { id: lineId.current++, cls, text, pre }]);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const run = useCallback(async () => {
    if (busy) {
      abortRef.current?.abort();
      setBusy(false);
      addLine('— aborted —', 'wa');
      return;
    }
    setBusy(true);
    setLines([]);
    setDone(0);
    abortRef.current = new AbortController();

    const prompt = agent.prompt(customCmd.trim());
    addLine('orbit ❯ ' + agent.name + ': ' + (customCmd.trim() || agent.task), 'cm');

    let toolCount = 0;
    await streamCrew(
      prompt,
      (text, cls) => {
        // Count tool calls (actions taken)
        if (cls === 'in' && text.startsWith('[')) {
          toolCount++;
          setDone(toolCount);
          addLine(text, 'in');
        } else {
          addLine(text, cls ?? 'mu');
        }
      },
      () => {
        setBusy(false);
        addLine('✔ Mission complete — ' + toolCount + ' action' + (toolCount !== 1 ? 's' : '') + ' taken', 'ok');
      },
      abortRef.current.signal
    );
  }, [busy, agent, customCmd, addLine]);

  return (
    <div className="agent-card" style={{ borderColor: agent.color + '44' }}>
      <div className="agent-hd" style={{ borderBottomColor: agent.color + '33' }}>
        <div className="agent-avatar" style={{ background: agent.color + '22', borderColor: agent.color + '66' }}>
          <span style={{ fontSize: 18 }}>{agent.emoji}</span>
        </div>
        <div className="agent-info">
          <div className="agent-name" style={{ color: agent.color }}>{agent.name}</div>
          <div className="agent-role">{agent.role}</div>
        </div>
        <div className="agent-stats">
          {done > 0 && <span className="agent-done" style={{ color: agent.color }}>{done} done</span>}
          <div className={`agent-led ${busy ? 'led-busy' : done > 0 ? 'led-done' : 'led-idle'}`}
            style={{ background: busy ? agent.color : done > 0 ? '#36d399' : '#2a4a6a' }}
          />
        </div>
      </div>

      <div className="agent-task">{agent.task}</div>

      <div className="agent-input-row">
        <input
          className="agent-cinp"
          value={customCmd}
          onChange={e => setCustomCmd(e.target.value)}
          placeholder="Override mission (optional)..."
          onKeyDown={e => e.key === 'Enter' && run()}
        />
        <button
          className="agent-btn"
          onClick={run}
          style={{
            background: busy
              ? 'linear-gradient(180deg,#5a3000,#3a2000)'
              : `linear-gradient(180deg,${agent.color}cc,${agent.color}66)`,
            boxShadow: busy ? 'none' : `0 0 12px ${agent.color}44`,
          }}
        >
          {busy ? '■ STOP' : agent.btn}
        </button>
      </div>

      <div className="agent-term" ref={termRef}>
        {lines.length === 0 && !busy && (
          <div className="agent-idle">Ready — press {agent.btn} to deploy</div>
        )}
        {lines.map(l => (
          <div key={l.id} className={`aln ${l.cls}`}>{l.text}</div>
        ))}
        {busy && <div className="aln mu">▌</div>}
      </div>
    </div>
  );
}

// ─── Global dispatch terminal ────────────────────────────────────────────────
function GlobalTerminal({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [lines, setLines] = useState<TLine[]>([
    { id: 0, cls: 'mu', text: 'Orbit Crew HQ online — 6 agents ready to deploy.' },
    { id: 1, cls: 'mu', text: 'Select an agent above to run their mission, or dispatch a custom order.' },
    { id: 2, cls: 'cm', text: '', pre: 'orbit ❯ ' },
  ]);
  const [cmd, setCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const lineId = useRef(3);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const addLine = (text: string, cls = 'mu', pre?: string) => {
    setLines(prev => [...prev.slice(-200), { id: lineId.current++, cls, text, pre }]);
  };

  const dispatch = async (command: string) => {
    if (!command.trim()) return;
    if (busy) { abortRef.current?.abort(); setBusy(false); return; }
    setBusy(true);
    setCmd('');
    abortRef.current = new AbortController();

    addLine(command, 'cm', 'orbit ❯ ');

    // Route to appropriate agent based on intent
    const lower = command.toLowerCase();
    let agentName = 'NOVA';
    if (lower.includes('lead') || lower.includes('prospect') || lower.includes('find') || lower.includes('business')) agentName = 'ASTRA';
    else if (lower.includes('sms') || lower.includes('message') || lower.includes('text') || lower.includes('draft')) agentName = 'REX';
    else if (lower.includes('deal') || lower.includes('pipeline') || lower.includes('stage') || lower.includes('close')) agentName = 'ORION';
    else if (lower.includes('task') || lower.includes('follow') || lower.includes('schedule') || lower.includes('remind')) agentName = 'LUNA';
    else if (lower.includes('report') || lower.includes('analyz') || lower.includes('stats') || lower.includes('insight')) agentName = 'VERA';

    const agent = AGENTS.find(a => a.name === agentName) || AGENTS[0];
    addLine('Deploying ' + agent.name + ' (' + agent.role + ')…', 'in');

    const prompt = agent.prompt(command);
    await streamCrew(
      prompt,
      (text, cls) => addLine(text, cls ?? 'mu'),
      () => {
        setBusy(false);
        addLine('', 'cm', 'orbit ❯ ');
      },
      abortRef.current.signal
    );
  };

  const CHIPS = [
    'Find 10 businesses that need websites',
    'Draft SMS for all contacts',
    'Create deals for every lead',
    'Schedule follow-ups for everyone',
    'Run full pipeline analysis',
    'Generate weekly ops report',
  ];

  return (
    <div className="global-term-wrap">
      <div className="tbar-inner">
        <div className="tdots"><i style={{background:'#ff5f57'}}/><i style={{background:'#febc2e'}}/><i style={{background:'#28c840'}}/></div>
        <span className="tlbl">ORBIT@CREW ~/ORBITCRM — MISSION DISPATCH</span>
        {busy && <span className="tlbl" style={{color:'#f4b942',marginLeft:'auto'}}>● RUNNING</span>}
      </div>
      <div className="tbody" ref={termRef}>
        {lines.map(l => (
          <div key={l.id} className={`ln ${l.cls}`}>
            {l.pre && <span className="pr">{l.pre}</span>}
            <span>{l.text}</span>
            {l.pre && !l.text && !busy && <span className="cur"/>}
          </div>
        ))}
        {busy && <div className="ln mu"><span className="cur"/></div>}
      </div>
      <div className="term-ctrl">
        <div className="crow">
          <input
            className="cinp"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && dispatch(cmd)}
            placeholder="e.g. Find 10 businesses that need websites in Miami..."
            autoComplete="off"
          />
          <button className="rbtn" onClick={() => dispatch(cmd)} disabled={!cmd.trim() && !busy}>
            {busy ? '■ STOP' : 'DISPATCH'}
          </button>
        </div>
        <div className="chips">
          {CHIPS.map(c => (
            <button key={c} className="chip" onClick={() => dispatch(c)}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Live stats bar ──────────────────────────────────────────────────────────
function StatsBar({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [stats, setStats] = useState({ total: 0, sms: 0, deals: 0, tasks: 0 });
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock(n.toUTCString().replace(/.*?(\d+:\d+:\d+).*/, '$1') + ' UTC');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.allSettled([
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).or('stage.ilike.%sms%,notes.ilike.%SMS:%'),
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setStats({
      total:  (a.status === 'fulfilled' ? a.value.count : 0) ?? 0,
      sms:    (b.status === 'fulfilled' ? b.value.count : 0) ?? 0,
      deals:  (c.status === 'fulfilled' ? c.value.count : 0) ?? 0,
      tasks:  (d.status === 'fulfilled' ? d.value.count : 0) ?? 0,
    });
  }, [supabase]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  return (
    <div className="topbar">
      <div>
        <div className="tl">△ ORBIT CREW HQ</div>
        <div className="ts">REAL AGENTS · REAL ACTIONS · LIVE SUPABASE</div>
      </div>
      <div className="tr">
        <span><b style={{color:'#00e5ff'}}>{stats.total}</b> Contacts</span>
        <span><b style={{color:'#36d399'}}>{stats.sms}</b> SMS Ready</span>
        <span><b style={{color:'#a78bfa'}}>{stats.deals}</b> Deals</span>
        <span><b style={{color:'#f4b942'}}>{stats.tasks}</b> Tasks</span>
        <span style={{color:'#00e5ff',fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{clock}</span>
      </div>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function CrewPage() {
  const supabase = createClient();

  return (
    <div className="crew-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        :root{--bg:#030a12;--hull:#05101e;--panel:#071628;--teal:#00e5ff;--green:#36d399;--red:#e8303a;--rs:#ff5d66;--amber:#f4b942;--violet:#a78bfa;--ink:#dff0ff;--dim:#5a8aaa;--faint:#2a4a6a;}
        .crew-page{background:var(--bg);color:var(--ink);font-family:'Orbitron',monospace;min-height:100vh;padding:10px 14px 32px;max-width:1400px;margin:0 auto;}

        /* Topbar */
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 18px;background:linear-gradient(180deg,#0a1e36,#040e1c);border:1px solid #0e2840;margin-bottom:12px;border-radius:8px;}
        .tl{font-size:16px;font-weight:900;letter-spacing:.15em;color:var(--teal);text-shadow:0 0 16px #00e5ff88;}
        .ts{font-size:7px;letter-spacing:.2em;color:var(--dim);margin-top:2px;}
        .tr{display:flex;gap:18px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;}

        /* Agent grid */
        .agents-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;}
        @media(max-width:1000px){.agents-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:600px){.agents-grid{grid-template-columns:1fr;}}

        /* Agent card */
        .agent-card{background:var(--hull);border:1px solid #0e2840;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;}
        .agent-hd{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #0e2840;}
        .agent-avatar{width:40px;height:40px;border-radius:8px;border:1px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .agent-info{flex:1;}
        .agent-name{font-size:12px;font-weight:900;letter-spacing:.12em;}
        .agent-role{font-size:8px;color:var(--dim);letter-spacing:.1em;margin-top:2px;text-transform:uppercase;}
        .agent-stats{display:flex;align-items:center;gap:8px;}
        .agent-done{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;}
        .agent-led{width:8px;height:8px;border-radius:50%;transition:background .3s;}
        .led-busy{animation:blk 0.7s steps(1) infinite;}
        @keyframes blk{50%{opacity:.2;}}

        .agent-task{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--dim);padding:8px 12px;line-height:1.5;min-height:44px;}

        .agent-input-row{display:flex;gap:6px;padding:0 8px 8px;}
        .agent-cinp{flex:1;background:#020b18;border:1px solid #0e2840;border-radius:5px;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:10px;padding:7px 9px;}
        .agent-cinp:focus{outline:none;border-color:var(--teal);}
        .agent-cinp::placeholder{color:var(--faint);}
        .agent-btn{border:none;border-radius:5px;padding:7px 10px;color:#000;font-family:'Orbitron',monospace;font-size:7px;font-weight:900;letter-spacing:.08em;cursor:pointer;white-space:nowrap;transition:all .15s;}
        .agent-btn:hover{filter:brightness(1.15);}

        .agent-term{flex:1;min-height:140px;max-height:220px;overflow-y:auto;padding:8px 10px;background:#020910;border-top:1px solid #0a1e30;font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.65;}
        .agent-term::-webkit-scrollbar{width:4px;}.agent-term::-webkit-scrollbar-thumb{background:#0e2840;border-radius:2px;}
        .agent-idle{color:var(--faint);font-style:italic;}
        .aln{white-space:pre-wrap;word-break:break-word;}
        .aln.cm{color:var(--ink);}.aln.ok{color:var(--green);}.aln.in{color:var(--teal);}.aln.mu{color:var(--dim);}.aln.ba{color:var(--red);}.aln.wa{color:var(--amber);}

        /* Global terminal */
        .global-term-wrap{background:#020910;border:1px solid #0e2840;border-radius:8px;overflow:hidden;margin-bottom:10px;}
        .tbar-inner{display:flex;align-items:center;gap:7px;padding:7px 12px;background:#030d1c;border-bottom:1px solid #0e2840;}
        .tdots{display:flex;gap:5px;}.tdots i{width:9px;height:9px;border-radius:50%;display:block;}
        .tlbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.15em;color:var(--faint);text-transform:uppercase;}
        .tbody{height:180px;overflow-y:auto;padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.7;}
        .tbody::-webkit-scrollbar{width:5px;}.tbody::-webkit-scrollbar-thumb{background:#0e2840;border-radius:3px;}
        .ln{display:flex;gap:6px;white-space:pre-wrap;word-break:break-word;}
        .pr{color:var(--rs);flex-shrink:0;}.ln.cm{color:var(--ink);}.ln.ok{color:var(--green);}.ln.in{color:var(--teal);}.ln.mu{color:var(--dim);}.ln.ba{color:var(--red);}.ln.wa{color:var(--amber);}
        .cur{display:inline-block;width:6px;height:12px;background:var(--red);vertical-align:-2px;animation:cu 1s steps(1) infinite;}
        @keyframes cu{50%{opacity:0;}}
        .term-ctrl{padding:10px 12px 12px;background:var(--hull);border-top:1px solid #0e2840;}
        .crow{display:flex;gap:8px;}
        .cinp{flex:1;background:#020b18;border:1px solid #0e2840;border-radius:6px;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:12px;padding:10px 13px;}
        .cinp:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 2px #00e5ff1a;}
        .cinp::placeholder{color:var(--faint);}
        .rbtn{background:linear-gradient(180deg,#d42030,#8a0f18);border:none;border-radius:6px;padding:0 18px;color:#fff;font-family:'Orbitron',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;cursor:pointer;box-shadow:0 0 14px #e8303a44;height:44px;}
        .rbtn:disabled{filter:grayscale(.7);box-shadow:none;cursor:not-allowed;}
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
        .chip{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--dim);background:#030c1c;border:1px solid #0e2840;border-radius:4px;padding:5px 10px;cursor:pointer;transition:border-color .12s,color .12s;}
        .chip:hover{border-color:var(--teal);color:var(--ink);}

        .section-hd{font-size:7px;letter-spacing:.25em;color:var(--faint);text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #0e2840;}
      `}</style>

      <StatsBar supabase={supabase} />

      <div className="section-hd">⚡ Deploy individual agents — each runs a real Claude-powered mission on your live CRM data</div>

      <div className="agents-grid">
        {AGENTS.map(agent => (
          <AgentCard key={agent.id} agent={agent} supabase={supabase} />
        ))}
      </div>

      <div className="section-hd">📡 Mission dispatch — describe what you need, the right agent auto-deploys</div>

      <GlobalTerminal supabase={supabase} />

      <div style={{textAlign:'center',marginTop:10,fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:'.15em',color:'var(--faint)',textTransform:'uppercase'}}>
        ORBIT CREW HQ · REAL WORKERS · CLAUDE SONNET 4.6 · LIVE SUPABASE
      </div>
    </div>
  );
}
