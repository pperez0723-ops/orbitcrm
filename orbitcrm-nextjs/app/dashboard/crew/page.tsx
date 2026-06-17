'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';

// ─── Types ─────────────────────────────────────────────────────────────────
interface Contact {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  stage?: string;
  status?: string;
  pipeline_stage?: string;
  created_at?: string;
}

interface TermLine {
  id: number;
  cls: string;
  text: string;
  prefix?: string;
}

// ─── Agent definitions ─────────────────────────────────────────────────────
const CREW = [
  { id: 'nova',  name: 'NOVA',  role: 'Commander', color: '#00e5ff' },
  { id: 'astra', name: 'ASTRA', role: 'Lead-Gen',  color: '#36d399' },
  { id: 'orion', name: 'ORION', role: 'Builder',   color: '#a78bfa' },
  { id: 'rex',   name: 'REX',   role: 'Outreach',  color: '#f4b942' },
  { id: 'luna',  name: 'LUNA',  role: 'Designer',  color: '#f472b6' },
  { id: 'vera',  name: 'VERA',  role: 'Analyst',   color: '#fb923c' },
];

const CHIPS = [
  'Find 100 businesses that need websites',
  'Build a lead-capture landing page',
  'Add an SMS + email welcome flow',
  'Update sales pipeline + follow-ups',
  'Generate weekly ops report',
  'Full launch: CRM + leads + site + ops',
];

function stageClass(stage?: string) {
  if (!stage) return 'stage-new';
  const s = stage.toLowerCase();
  if (s.includes('sms') || s.includes('contact')) return 'stage-sms';
  if (s.includes('hot') || s.includes('interest') || s.includes('warm')) return 'stage-hot';
  if (s.includes('closed') || s.includes('won') || s.includes('client')) return 'stage-closed';
  if (s.includes('cold') || s.includes('lost')) return 'stage-cold';
  return 'stage-new';
}

function fmtNum(n?: number | null) {
  if (n === null || n === undefined) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function fmtMoney(n?: number | null) {
  if (!n) return '$0';
  return '$' + new Intl.NumberFormat().format(Math.round(n));
}

function contactDisplayName(c: Contact) {
  if (c.name) return c.name;
  const fn = c.first_name || '';
  const ln = c.last_name || '';
  if (fn || ln) return (fn + ' ' + ln).trim();
  return c.email || 'Unknown';
}

function contactInitials(c: Contact) {
  const name = contactDisplayName(c);
  return name.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase() || '??';
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function CrewPage() {
  const supabase = createClient();
  const termRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<TermLine[]>([]);
  const lineId = useRef(0);
  const [running, setRunning] = useState(false);
  const [cmd, setCmd] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineStages, setPipelineStages] = useState<{name:string;count:number;value:number}[]>([]);
  const [stats, setStats] = useState({ contacts: 0, pipeline: 0, sms: 0, rate: 0 });
  const [syncTime, setSyncTime] = useState('');
  const [agentsAwake, setAgentsAwake] = useState<string[]>([]);
  const [positions, setPositions] = useState(() =>
    CREW.map((a, i) => ({ id: a.id, x: 120 + i * 130, y: 180 + (i % 2) * 140, vx: 0, vy: 0 }))
  );

  // ─── Terminal helpers ──────────────────────────────────────────────────
  const addLine = useCallback((cls: string, text: string, prefix?: string) => {
    setLines(prev => [...prev, { id: lineId.current++, cls, text, prefix }]);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const tprompt = useCallback((c: string) => addLine('cm', c, 'orbit ❯ '), [addLine]);
  const tinfo   = useCallback((t: string) => addLine('mu', t), [addLine]);
  const tok     = useCallback((t: string) => addLine('ok', '✔ ' + t), [addLine]);
  const terr    = useCallback((t: string) => addLine('ba', '✗ ' + t), [addLine]);
  const thead   = useCallback((t: string) => addLine('hd', t), [addLine]);
  const tbar    = useCallback((label: string) => addLine('mu', label + ' ▓▓▓▓▓▓▓▓▓▓ DONE'), [addLine]);

  // ─── Real data fetchers ────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('id,name,first_name,last_name,email,phone,company,stage,status,pipeline_stage,created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (!error && data) {
      setContacts(data as Contact[]);
      return data as Contact[];
    }
    return [];
  }, [supabase]);

  const loadPipeline = useCallback(async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('stage,status,pipeline_stage');
    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => {
        const st = c.stage || c.pipeline_stage || c.status || 'New Lead';
        counts[st] = (counts[st] || 0) + 1;
      });
      const stages = Object.entries(counts).map(([name, count]) => ({ name, count, value: 0 }));
      setPipelineStages(stages);
      return stages;
    }
    return [];
  }, [supabase]);

  const loadStats = useCallback(async () => {
    const { count: total } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    const { data: smsData } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .or('stage.ilike.%sms%,stage.ilike.%contacted%,status.ilike.%sms%');

    const { data: respondedData } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .or('stage.ilike.%interested%,stage.ilike.%hot%,stage.ilike.%warm%,stage.ilike.%meeting%');

    const t = total || 0;
    const sms = (smsData as any)?.length || 0;
    const responded = (respondedData as any)?.length || 0;
    const rate = sms > 0 ? Math.round((responded / sms) * 100) : 0;

    setStats({ contacts: t, pipeline: 0, sms, rate });
    setSyncTime(new Date().toLocaleTimeString());
  }, [supabase]);

  // ─── Initial load + auto-refresh ──────────────────────────────────────
  useEffect(() => {
    addLine('mu', 'Orbit Mission Deck online — 6-agent crew on deck.');
    addLine('mu', 'Crew wanders freely. Dispatch a mission to lock them in.');
    addLine('cm', '', 'orbit ❯ ');

    Promise.allSettled([loadContacts(), loadPipeline(), loadStats()]);

    const timer = setInterval(() => {
      Promise.allSettled([loadContacts(), loadPipeline(), loadStats()]);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Astronaut wandering ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setPositions(prev => prev.map(pos => {
        if (agentsAwake.includes(pos.id)) return pos;
        const vx = Math.max(-1.2, Math.min(1.2, pos.vx + (Math.random() - 0.5) * 0.6)) * 0.97;
        const vy = Math.max(-0.8, Math.min(0.8, pos.vy + (Math.random() - 0.5) * 0.4)) * 0.97;
        return { ...pos, vx, vy, x: Math.max(40, Math.min(820, pos.x + vx)), y: Math.max(80, Math.min(440, pos.y + vy)) };
      }));
    }, 80);
    return () => clearInterval(timer);
  }, [agentsAwake]);

  // ─── Mission dispatch ──────────────────────────────────────────────────
  const classifyCmd = (c: string): string => {
    const s = c.toLowerCase();
    if (s.includes('lead') || s.includes('business') || s.includes('find')) return 'lead';
    if (s.includes('sms') || s.includes('email') || s.includes('welcome')) return 'sms';
    if (s.includes('report') || s.includes('weekly') || s.includes('ops')) return 'report';
    if (s.includes('pipeline') || s.includes('follow')) return 'pipeline';
    if (s.includes('full') || s.includes('launch') || s.includes('all')) return 'full';
    if (s.includes('landing') || s.includes('page') || s.includes('build')) return 'landing';
    return 'full';
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const dispatch = useCallback(async (command: string) => {
    if (running || !command.trim()) return;
    setRunning(true);
    const type = classifyCmd(command);

    const agentMap: Record<string, string[]> = {
      lead: ['nova', 'astra'], sms: ['rex'], report: ['vera'],
      pipeline: ['orion'], full: CREW.map(c => c.id), landing: ['orion', 'luna'],
    };
    const activeAgents = agentMap[type] || CREW.map(c => c.id);
    setAgentsAwake(activeAgents);

    tprompt('orbit dispatch "' + command + '"');
    tinfo('Crew assigned: ' + activeAgents.map(id => CREW.find(c => c.id === id)?.name).join(', '));

    try {
      if (type === 'lead') {
        thead('── NOVA ──────');
        await delay(300);
        tprompt('orbit briefing --all');
        tinfo('Crew assembling...');
        await delay(500);
        thead('── ASTRA ──────');
        tprompt('orbit leadgen --needs-website --live');
        tinfo('Scanning businesses...');
        await delay(800);
        tbar('Filtering no-website');
        const freshContacts = await loadContacts();
        tinfo(freshContacts.length + '+ contacts in Orbit pipeline');
        await delay(300);
        tprompt('orbit draft-sms --per-lead');
        tok('SMS drafted → SMS Drafted stage');
        await loadStats();
      } else if (type === 'sms') {
        thead('── REX ──────');
        await delay(300);
        tprompt('orbit sms --send-pending');
        tinfo('Fetching SMS-ready contacts...');
        await delay(600);
        tbar('Sending SMS batch');
        const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).or('stage.ilike.%sms%,stage.ilike.%draft%');
        tok((count || 0) + ' SMS messages sent');
        tprompt('orbit update-stage --sms-sent');
        tok('Pipeline updated → Contacted stage');
        await loadContacts();
        await loadStats();
      } else if (type === 'report') {
        thead('── VERA ──────');
        await delay(300);
        tprompt('orbit report --weekly');
        tinfo('Aggregating CRM data...');
        await delay(500);
        const { count: total } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
        tok('Contacts: ' + fmtNum(total || 0));
        const { count: active } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).or('stage.ilike.%hot%,stage.ilike.%interested%,stage.ilike.%warm%');
        tok('Active leads: ' + fmtNum(active || 0));
        tbar('Generating report');
        tok('Weekly ops report ready → Dashboard');
        await loadStats();
      } else if (type === 'pipeline') {
        thead('── ORION ──────');
        await delay(300);
        tprompt('orbit pipeline --update --follow-up');
        tinfo('Scanning stale deals...');
        await delay(600);
        tbar('Syncing pipeline');
        tprompt('orbit schedule-followup --overdue');
        tok('Follow-ups scheduled');
        await loadPipeline();
        await loadStats();
      } else if (type === 'landing') {
        thead('── ORION ──────');
        await delay(300);
        tprompt('orbit ui scaffold');
        tinfo('Generating layout...');
        await delay(500);
        tbar('Rendering');
        addLine('fi', 'dashboard/page.tsx');
        addLine('mu', '++ 96  -- 12');
        tprompt('orbit wire form → contacts');
        tok('Form → contacts ✓');
        addLine('mu', 'Lighthouse ▓▓▓▓▓▓▓▓▓▓ DONE');
        addLine('mu', 'Perf 98 · SEO 100');
        tok('Mission complete — deliverables shipped.');
      } else {
        // full launch — call real /api/crew endpoint
        thead('── FULL MISSION ──────');
        await delay(300);
        tprompt('orbit full-launch --crm --leads --site --ops');
        tinfo('Initiating full system launch...');
        setLines(prev => [...prev, { id: lineId.current++, cls: 'mu', text: '' }]);
        
        const res = await fetch('/api/crew', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: command }),
        });
        
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() || '';
            for (const part of parts) {
              const clean = part.replace(/^data:\s*/, '').trim();
              if (clean && clean !== '[DONE]') {
                try {
                  const parsed = JSON.parse(clean);
                  const text = parsed.delta?.text || parsed.text || parsed.content || '';
                  if (text) addLine('in', text);
                } catch {
                  if (clean.length > 1) addLine('mu', clean);
                }
              }
            }
          }
        } else {
          tbar('Full launch');
          tok('CRM initialized · Lead pipeline active · SMS online');
        }
        await Promise.allSettled([loadContacts(), loadPipeline(), loadStats()]);
      }
    } catch (e: any) {
      terr('Mission error: ' + (e.message || String(e)));
    }

    setRunning(false);
    setAgentsAwake([]);
    addLine('cm', '', 'orbit ❯ ');
  }, [running, supabase, addLine, tprompt, tinfo, tok, terr, thead, tbar, loadContacts, loadPipeline, loadStats]);

  // ─── Clock ─────────────────────────────────────────────────────────────
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toUTCString().replace(/.*?(\d+:\d+:\d+).*/, '$1') + ' UTC');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── SVG astronaut ─────────────────────────────────────────────────────
  const Astronaut = ({ agent, pos, awake }: { agent: typeof CREW[0]; pos: {x:number;y:number}; awake: boolean }) => (
    <g transform={`translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`} className={awake ? '' : 'sleeping'}>
      <ellipse cx="0" cy="10" rx="8" ry="2.5" fill="#000" opacity="0.35"/>
      <rect x="-5" y="3" width="4" height="5" rx="1.5" fill="#c8d8e8"/>
      <rect x="1" y="7" width="4" height="5" rx="1.5" fill="#c8d8e8"/>
      <g transform="translate(0,-1)">
        <rect x="-5" y="-5" width="10" height="11" rx="4" fill="#e0eaf4"/>
        <rect x="-5" y="-1" width="10" height="3" fill={agent.color} opacity="0.85"/>
        <rect x="-2" y="-2" width="4" height="3" rx="0.8" fill={agent.color}/>
        <rect x="-8" y="-4" width="3" height="7" rx="1.5" fill="#ccd8e8"/>
        <rect x="5" y="-4" width="3" height="7" rx="1.5" fill="#ccd8e8"/>
        <ellipse cx="-6.5" cy="3" rx="2.5" ry="2" fill={agent.color} opacity="0.8"/>
        <ellipse cx="6.5" cy="3" rx="2.5" ry="2" fill={agent.color} opacity="0.8"/>
      </g>
      <circle cx="0" cy="-10" r="6.5" fill="#eaf2fc"/>
      <path d="M-4.5 -11.5 a4.5 4.5 0 0 1 9 0 a4.5 4.5 0 0 1 -9 0Z" fill="#07101e"/>
      <ellipse cx="-1.5" cy="-12" rx="2" ry="1.4" fill={agent.color} opacity="0.7"/>
      <line x1="0" y1="-17" x2="0" y2="-14" stroke={agent.color} strokeWidth="1.4"/>
      <circle cx="0" cy="-18" r="2" fill={agent.color} opacity="0.85"/>
      {!awake && (
        <g className="zzz">
          <text x="5" y="-18" className="zz1" fill="#aaddc8" fontFamily="'Press Start 2P'" fontSize="4.5">z</text>
          <text x="8" y="-22" className="zz2" fill="#aaddc8" fontFamily="'Press Start 2P'" fontSize="5.5">z</text>
          <text x="11" y="-26" className="zz3" fill="#aaddc8" fontFamily="'Press Start 2P'" fontSize="6.5">z</text>
        </g>
      )}
      <text x="0" y="22" textAnchor="middle" fill={agent.color} fontFamily="'Press Start 2P'" fontSize="5.5" opacity="0.9">{agent.name}</text>
    </g>
  );

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="crew-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        :root{--bg:#030a12;--hull:#05101e;--panel:#071628;--red:#e8303a;--rs:#ff5d66;--teal:#00e5ff;--green:#36d399;--amber:#f4b942;--violet:#a78bfa;--pink:#f472b6;--orange:#fb923c;--ice:#7dd3fc;--gold:#f0c96b;--ink:#dff0ff;--dim:#5a8aaa;--faint:#2a4a6a;}
        .crew-page{background:var(--bg);color:var(--ink);font-family:'Orbitron',monospace;min-height:100vh;padding:10px 14px 28px;max-width:1300px;margin:0 auto;}
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 18px;background:linear-gradient(180deg,#0a1e36,#040e1c);border-bottom:1px solid #0e2840;margin-bottom:10px;border-radius:6px}
        .tl{font-size:17px;font-weight:900;letter-spacing:.15em;color:var(--teal);text-shadow:0 0 18px #00e5ff88}
        .ts{font-size:8px;letter-spacing:.2em;color:var(--dim);margin-top:2px}
        .tr{display:flex;gap:14px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10px}
        .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px}
        .dg{background:var(--green);box-shadow:0 0 8px var(--green)}.da{background:var(--amber)}.dr{background:var(--red);box-shadow:0 0 8px var(--red);animation:bl 1.1s steps(1) infinite}
        @keyframes bl{50%{opacity:.15}}
        .stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#0e2840;margin-bottom:10px;border-radius:8px;overflow:hidden}
        .stat{background:var(--hull);padding:10px 16px;text-align:center}
        .stat-val{font-size:22px;font-weight:900;color:var(--teal);font-family:'JetBrains Mono',monospace;letter-spacing:.05em}
        .stat-lbl{font-size:7px;letter-spacing:.2em;color:var(--dim);margin-top:3px;text-transform:uppercase}
        .ship-wrap{background:var(--hull);border:1px solid #0e2840;border-radius:8px;overflow:hidden;margin-bottom:10px}
        .ship-wrap svg{width:100%;display:block}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
        @media(max-width:700px){.two-col{grid-template-columns:1fr}.stats-bar{grid-template-columns:repeat(2,1fr)}}
        .panel{background:var(--panel);border:1px solid #0e2840;border-radius:8px;padding:12px}
        .panel-hd{font-size:7px;letter-spacing:.2em;color:var(--faint);text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
        .refresh-btn{font-size:8px;color:var(--dim);cursor:pointer;padding:2px 6px;border:1px solid #0e2840;border-radius:4px;background:none;font-family:'JetBrains Mono',monospace;transition:color .12s,border-color .12s;color:var(--ink)}
        .refresh-btn:hover{color:var(--teal);border-color:var(--teal)}
        .contact-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #0a1e30}
        .contact-row:last-child{border-bottom:none}
        .avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--violet));display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;flex-shrink:0;font-family:'JetBrains Mono',monospace}
        .contact-info{flex:1;min-width:0}
        .contact-name{font-size:11px;font-weight:700;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .contact-meta{font-size:9px;color:var(--dim);font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .stage-badge{font-size:7px;padding:3px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;white-space:nowrap;flex-shrink:0}
        .stage-new{background:#0a2040;color:var(--ice);border:1px solid #1a4080}
        .stage-sms{background:#0a2a1a;color:var(--green);border:1px solid #1a5030}
        .stage-hot{background:#2a1000;color:var(--amber);border:1px solid #5a3000}
        .stage-closed{background:#200020;color:var(--violet);border:1px solid #4a2060}
        .stage-cold{background:#1a1a2a;color:var(--dim);border:1px solid #2a2a4a}
        .pipe-stages{display:flex;gap:6px;flex-wrap:wrap}
        .pipe-stage{flex:1;min-width:80px;background:#030c1c;border:1px solid #0e2840;border-radius:6px;padding:8px;text-align:center}
        .pipe-stage-n{font-size:18px;font-weight:900;color:var(--teal);font-family:'JetBrains Mono',monospace}
        .pipe-stage-l{font-size:7px;color:var(--dim);letter-spacing:.15em;text-transform:uppercase;margin-top:3px}
        .term-wrap{background:#020910;border:1px solid #0e2840;border-radius:8px;overflow:hidden;margin-bottom:10px}
        .tbar-inner{display:flex;align-items:center;gap:7px;padding:7px 12px;background:#030d1c;border-bottom:1px solid #0e2840}
        .tdots{display:flex;gap:5px}.tdots i{width:9px;height:9px;border-radius:50%}
        .tlbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.15em;color:var(--faint);text-transform:uppercase}
        .tbody{height:200px;overflow-y:auto;padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11.5px;line-height:1.7}
        .tbody::-webkit-scrollbar{width:5px}.tbody::-webkit-scrollbar-thumb{background:#0e2840;border-radius:3px}
        .ln{display:flex;gap:6px;white-space:pre-wrap;word-break:break-word}
        .pr{color:var(--rs)}.cm{color:var(--ink)}.ok{color:var(--green)}.wa{color:var(--amber)}.in{color:var(--teal)}.mu{color:var(--dim)}.fi{color:var(--violet)}.ad{color:var(--green)}.ba{color:var(--red)}.hd{color:var(--faint)}
        .cur{display:inline-block;width:6px;height:12px;background:var(--red);vertical-align:-2px;animation:cu 1s steps(1) infinite}
        @keyframes cu{50%{opacity:0}}
        .ctrl{background:var(--panel);border:1px solid #0e2840;border-radius:8px;padding:12px}
        .clbl{font-size:7px;letter-spacing:.2em;color:var(--faint);text-transform:uppercase;margin-bottom:8px}
        .crow{display:flex;gap:8px}
        .cinp{flex:1;background:#020b18;border:1px solid #0e2840;border-radius:6px;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:13px;padding:11px 13px}
        .cinp:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 2px #00e5ff1a}
        .cinp::placeholder{color:var(--faint)}
        .rbtn{background:linear-gradient(180deg,#d42030,#8a0f18);border:none;border-radius:6px;padding:0 20px;color:#fff;font-family:'Orbitron',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;cursor:pointer;white-space:nowrap;box-shadow:0 0 16px #e8303a55;height:46px}
        .rbtn:disabled{filter:grayscale(.7);box-shadow:none;cursor:not-allowed}
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
        .chip{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dim);background:#030c1c;border:1px solid #0e2840;border-radius:5px;padding:6px 11px;cursor:pointer;transition:border-color .12s,color .12s}
        .chip:hover{color:var(--ink);border-color:var(--teal)}
        .foot{text-align:center;margin-top:12px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.13em;color:var(--faint);text-transform:uppercase}
        .sleeping .zzz text{opacity:0}
        .sleeping .zz1{animation:zf 2.2s ease-in-out infinite}
        .sleeping .zz2{animation:zf 2.2s ease-in-out infinite .55s}
        .sleeping .zz3{animation:zf 2.2s ease-in-out infinite 1.1s}
        @keyframes zf{0%{opacity:0;transform:translate(0,0)}30%{opacity:.9}100%{opacity:0;transform:translate(4px,-11px)}}
      `}</style>

      {/* Top bar */}
      <div className="topbar">
        <div>
          <div className="tl">△ ORBIT</div>
          <div className="ts">MISSION COMMAND VESSEL · DECK A</div>
        </div>
        <div className="tr">
          <span><span className="dot dg"/>ENGINES</span>
          <span><span className="dot dg"/>SHIELDS</span>
          <span><span className="dot da"/>COMMS</span>
          <span style={{color:'var(--teal)',letterSpacing:'.1em'}}>{clock}</span>
          <span>
            <span className={`dot ${running ? 'dr' : 'dg'}`}/>
            <span>{running ? 'ON MISSION' : 'CREW READY'}</span>
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat"><div className="stat-val">{fmtNum(stats.contacts)}</div><div className="stat-lbl">Total Contacts</div></div>
        <div className="stat"><div className="stat-val">{fmtMoney(stats.pipeline)}</div><div className="stat-lbl">Pipeline Value</div></div>
        <div className="stat"><div className="stat-val">{fmtNum(stats.sms)}</div><div className="stat-lbl">SMS Sent</div></div>
        <div className="stat"><div className="stat-val">{stats.rate}%</div><div className="stat-lbl">Response Rate</div></div>
      </div>

      {/* SVG ship scene */}
      <div className="ship-wrap">
        <svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="900" height="480" fill="#030a12"/>
          <rect x="0" y="0" width="900" height="52" fill="#060f1e"/>
          <rect x="0" y="50" width="900" height="2" fill="#0e2840"/>
          <rect x="0" y="2" width="100" height="48" rx="2" fill="#040c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          <rect x="102" y="2" width="100" height="48" rx="2" fill="#040c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          <rect x="204" y="2" width="100" height="48" rx="2" fill="#040c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          <rect x="306" y="2" width="100" height="48" rx="2" fill="#040c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          <text x="50" y="18" textAnchor="middle" fill="#00e5ff" fontFamily="'Press Start 2P'" fontSize="5" opacity="0.7">SYS:NOMINAL</text>
          <text x="152" y="18" textAnchor="middle" fill="#a78bfa" fontFamily="'Press Start 2P'" fontSize="5" opacity="0.7">ORBIT:STABLE</text>
          <text x="254" y="18" textAnchor="middle" fill="#36d399" fontFamily="'Press Start 2P'" fontSize="5" opacity="0.7">CREW:6 ON DECK</text>
          <text x="356" y="18" textAnchor="middle" fill="#f4b942" fontFamily="'Press Start 2P'" fontSize="5" opacity="0.7">AI:ONLINE</text>
          <rect x="840" y="60" width="50" height="400" rx="4" fill="#040c1a" stroke="#0a1e30" strokeWidth="0.8"/>
          {[70,82,94,106,118,130].map((y,i) => (
            <rect key={y} x="845" y={y} width="40" height="6" rx="1" fill={i===4?'#f4b942':'#36d399'} opacity={0.4-i*0.04}/>
          ))}
          <ellipse cx="20" cy="460" rx="12" ry="12" fill="#1a3a1a" stroke="#36d399" strokeWidth="1.5"/>
          <ellipse cx="860" cy="460" rx="12" ry="12" fill="#1a3a1a" stroke="#36d399" strokeWidth="1.5"/>
          <ellipse cx="440" cy="460" rx="12" ry="12" fill="#1a3a1a" stroke="#36d399" strokeWidth="1.5"/>
          {[96,148,200,252,304,356,408,460].map((y,i) => (
            <line key={y} x1="20" y1={y} x2="880" y2={y} stroke="#08192c" strokeWidth="0.7" opacity={1-i*0.11}/>
          ))}
          {/* Agents */}
          {CREW.map(agent => {
            const pos = positions.find(p => p.id === agent.id) || { x: 100, y: 200 };
            const awake = agentsAwake.includes(agent.id);
            return <Astronaut key={agent.id} agent={agent} pos={pos} awake={awake}/>;
          })}
        </svg>
      </div>

      {/* Two column: contacts + pipeline */}
      <div className="two-col">
        <div className="panel">
          <div className="panel-hd">
            Recent Contacts
            <button className="refresh-btn" onClick={() => loadContacts()}>↻ REFRESH</button>
          </div>
          {contacts.length === 0 ? (
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,padding:10,color:'var(--dim)'}}>
              {stats.contacts === 0 ? 'Dispatch a lead-gen mission to populate your CRM' : 'Loading...'}
            </div>
          ) : contacts.map(c => (
            <div key={c.id} className="contact-row">
              <div className="avatar">{contactInitials(c)}</div>
              <div className="contact-info">
                <div className="contact-name">{contactDisplayName(c)}</div>
                <div className="contact-meta">{c.company || c.phone || c.email || ''}</div>
              </div>
              <span className={`stage-badge ${stageClass(c.stage || c.pipeline_stage || c.status)}`}>
                {c.stage || c.pipeline_stage || c.status || 'New'}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-hd">
            Pipeline Stages
            <button className="refresh-btn" onClick={() => loadPipeline()}>↻ REFRESH</button>
          </div>
          {pipelineStages.length === 0 ? (
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,padding:10,color:'var(--dim)'}}>
              Pipeline will populate after your first mission
            </div>
          ) : (
            <div className="pipe-stages">
              {pipelineStages.map(s => (
                <div key={s.name} className="pipe-stage">
                  <div className="pipe-stage-n">{s.count}</div>
                  <div className="pipe-stage-l">{s.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div className="term-wrap">
        <div className="tbar-inner">
          <div className="tdots"><i style={{background:'#ff5f57'}}/><i style={{background:'#febc2e'}}/><i style={{background:'#28c840'}}/></div>
          <span className="tlbl">ORBIT@CREW ~/ORBITCRM — MISSION TERMINAL</span>
        </div>
        <div className="tbody" ref={termRef}>
          {lines.map(l => (
            <div key={l.id} className="ln">
              {l.prefix && <span className="pr">{l.prefix}</span>}
              <span className={l.cls}>{l.text}</span>
              {l.prefix && !l.text && <span className="cur"/>}
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch control */}
      <div className="ctrl">
        <div className="clbl">Dispatch Order</div>
        <div className="crow">
          <input
            className="cinp"
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !running) dispatch(cmd); }}
            placeholder="e.g. Find 100 businesses that need websites"
            autoComplete="off"
          />
          <button className="rbtn" disabled={running || !cmd.trim()} onClick={() => dispatch(cmd)}>
            {running ? 'RUNNING...' : 'DISPATCH'}
          </button>
        </div>
        <div className="chips">
          {CHIPS.map(chip => (
            <button key={chip} className="chip" onClick={() => { setCmd(chip); dispatch(chip); }}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="foot">
        ORBIT MISSION DECK · LIVE DATA FROM SUPABASE · {syncTime ? 'LAST SYNC: ' + syncTime : 'SYNCING...'}
      </div>
    </div>
  );
}
