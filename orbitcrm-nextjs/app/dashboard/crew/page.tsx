'use client';
// app/dashboard/crew/page.tsx
// Orbit Workstation — pixel-art office scene inspired by agent-office.
// Four crew members sit at pixel desks. When working they animate (typing, thinking, walking).
// Live SSE terminal log scrolls on the right. All self-contained CSS, no external deps.

import { useRef, useState, useEffect, useCallback } from 'react';

type Line = { cls: string; text: string; agent?: string };
type AgentState = 'idle' | 'thinking' | 'working' | 'walking' | 'done';

const CREW = {
  director:   { name: 'Director',    role: 'coordinator',          color: '#e8303a', desk: { x: 18, y: 12 }, avatar: 0 },
  researcher: { name: 'Researcher',  role: 'intel · analysis',     color: '#37e0c5', desk: { x: 62, y: 12 }, avatar: 1 },
  webdev:     { name: 'Web Dev',     role: 'sites · ui',           color: '#a78bfa', desk: { x: 18, y: 58 }, avatar: 2 },
  appdev:     { name: 'App Dev',     role: 'backend · automations', color: '#f4b942', desk: { x: 62, y: 58 }, avatar: 3 },
} as const;

type CrewKey = keyof typeof CREW;

const QUICK = [
  'Create a contact named Maria Lopez at Brightstar Realty and add a follow-up task',
  'Add an automation: when a contact is created, send a welcome SMS and email',
  'Analyze my pipeline and tell me which leads to prioritize',
  'Draft a lead-capture landing page for Orbit',
];

const EMOTES: Record<AgentState, string> = {
  idle: '😌', thinking: '💡', working: '💻', walking: '🚶', done: '✅',
};

// ── Pixel-art SVG pieces ───────────────────────────────────────────────────
function PixelDesk({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* desk surface */}
      <rect x="0" y="8" width="34" height="20" rx="2" fill="#1e1528" stroke="#3a2540" strokeWidth="1.5"/>
      <rect x="2" y="10" width="30" height="12" rx="1" fill="#140f1e" stroke={color} strokeWidth="0.5" opacity="0.7"/>
      {/* monitor */}
      <rect x="8" y="0" width="18" height="12" rx="1.5" fill="#0a0812" stroke={color} strokeWidth="1"/>
      <rect x="10" y="2" width="14" height="8" rx="0.5" fill="#0d1a2e"/>
      {/* screen glow lines */}
      <rect x="11" y="3" width="6" height="1.5" rx="0.5" fill={color} opacity="0.9"/>
      <rect x="11" y="5.5" width="9" height="1" rx="0.5" fill={color} opacity="0.5"/>
      <rect x="11" y="7" width="7" height="1" rx="0.5" fill={color} opacity="0.4"/>
      {/* monitor stand */}
      <rect x="15" y="12" width="4" height="3" fill="#1e1528"/>
      {/* keyboard */}
      <rect x="3" y="18" width="16" height="6" rx="1" fill="#1a1228" stroke="#33204a" strokeWidth="0.5"/>
      <rect x="4" y="19" width="4" height="1.5" rx="0.3" fill="#2a1f40"/>
      <rect x="9" y="19" width="4" height="1.5" rx="0.3" fill="#2a1f40"/>
      <rect x="14" y="19" width="4" height="1.5" rx="0.3" fill="#2a1f40"/>
      <rect x="4" y="21.5" width="13" height="1.5" rx="0.3" fill="#2a1f40"/>
      {/* mouse */}
      <rect x="22" y="19" width="8" height="5" rx="2" fill="#1a1228" stroke="#33204a" strokeWidth="0.5"/>
      {/* legs */}
      <rect x="2" y="28" width="3" height="6" rx="1" fill="#140f1e"/>
      <rect x="29" y="28" width="3" height="6" rx="1" fill="#140f1e"/>
    </g>
  );
}

function PixelChair({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="2" y="4" width="12" height="8" rx="2" fill="#1a1228" stroke={color} strokeWidth="0.7" opacity="0.8"/>
      <rect x="0" y="12" width="16" height="3" rx="1.5" fill="#140f1e" stroke="#33204a" strokeWidth="0.5"/>
      <rect x="6" y="15" width="4" height="5" fill="#140f1e"/>
      <rect x="2" y="20" width="5" height="2" rx="1" fill="#1a1228"/>
      <rect x="9" y="20" width="5" height="2" rx="1" fill="#1a1228"/>
    </g>
  );
}

function PixelAgent({ x, y, color, state, avatar }: { x: number; y: number; color: string; state: AgentState; avatar: number }) {
  // 4 distinct pixel avatar hair/shirt combos
  const hair = ['#4a2820', '#2a4a38', '#1e2a4a', '#3a2a0a'];
  const shirt = [color, color, color, color];
  const isTyping = state === 'working';
  const isThinking = state === 'thinking';
  const isWalking = state === 'walking';

  return (
    <g transform={`translate(${x},${y})`} className={`pixel-agent pixel-${state}`}>
      {/* shadow */}
      <ellipse cx="8" cy="28" rx="7" ry="2" fill="#000" opacity="0.25"/>
      {/* legs */}
      <rect x="4" y="20" width="4" height="8" rx="1" fill="#1e1528" className={isWalking ? 'walk-l' : ''}/>
      <rect x="9" y="20" width="4" height="8" rx="1" fill="#1e1528" className={isWalking ? 'walk-r' : ''}/>
      {/* body */}
      <rect x="2" y="10" width="14" height="12" rx="3" fill={shirt[avatar]}/>
      {/* collar */}
      <rect x="6" y="10" width="5" height="3" rx="1" fill="#d9b29b"/>
      {/* arms */}
      <rect x="-1" y="11" width="4" height="9" rx="2" fill={shirt[avatar]} className={isTyping ? 'type-l' : ''}/>
      <rect x="15" y="11" width="4" height="9" rx="2" fill={shirt[avatar]} className={isTyping ? 'type-r' : ''}/>
      {/* hands */}
      <rect x="-1" y="19" width="4" height="3" rx="1.5" fill="#d9b29b"/>
      <rect x="15" y="19" width="4" height="3" rx="1.5" fill="#d9b29b"/>
      {/* neck */}
      <rect x="6" y="7" width="5" height="4" rx="1.5" fill="#d9b29b"/>
      {/* head */}
      <rect x="2" y="-2" width="13" height="11" rx="4" fill="#d9b29b"/>
      {/* hair */}
      <rect x="2" y="-2" width="13" height="5" rx="3" fill={hair[avatar]}/>
      <rect x="2" y="-2" width="4" height="8" rx="2" fill={hair[avatar]}/>
      {/* eyes */}
      <rect x="5" y="2" width="2" height="2" rx="0.5" fill="#241a14" className={isThinking ? 'eye-blink' : ''}/>
      <rect x="10" y="2" width="2" height="2" rx="0.5" fill="#241a14" className={isThinking ? 'eye-blink' : ''}/>
      {/* thinking dots */}
      {isThinking && (
        <>
          <circle cx="4" cy="-6" r="1" fill={color} className="think-dot1"/>
          <circle cx="8" cy="-9" r="1.5" fill={color} className="think-dot2"/>
          <circle cx="13" cy="-7" r="1" fill={color} className="think-dot3"/>
        </>
      )}
    </g>
  );
}

function PixelPlant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="3" y="10" width="8" height="8" rx="1" fill="#1a1228" stroke="#33204a" strokeWidth="0.5"/>
      <circle cx="7" cy="8" r="5" fill="#1a3a28"/>
      <circle cx="4" cy="10" r="3" fill="#1a3a28"/>
      <circle cx="10" cy="10" r="3" fill="#1a3a28"/>
      <circle cx="7" cy="5" r="3" fill="#1f4a30"/>
      <rect x="6" y="8" width="2" height="6" fill="#0f2218"/>
    </g>
  );
}

function PixelWindow({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="0" y="0" width="24" height="20" rx="2" fill="#0d1a2e" stroke="#1e2a40" strokeWidth="1.5"/>
      <rect x="2" y="2" width="20" height="16" rx="1" fill="#0a1528"/>
      {/* cross frame */}
      <rect x="11" y="2" width="2" height="16" fill="#1e2a40"/>
      <rect x="2" y="10" width="20" height="2" fill="#1e2a40"/>
      {/* sky glow */}
      <rect x="3" y="3" width="7" height="6" rx="0.5" fill="#0d3060" opacity="0.6"/>
      <rect x="14" y="3" width="7" height="6" rx="0.5" fill="#0d3060" opacity="0.6"/>
      {/* stars */}
      <circle cx="5" cy="5" r="0.5" fill="#fff" opacity="0.8"/>
      <circle cx="9" cy="4" r="0.5" fill="#fff" opacity="0.6"/>
      <circle cx="16" cy="6" r="0.5" fill="#fff" opacity="0.7"/>
      <circle cx="20" cy="4" r="0.5" fill="#fff" opacity="0.5"/>
    </g>
  );
}

function OfficePlant({ x, y }: { x: number; y: number }) {
  return <PixelPlant x={x} y={y} />;
}

// ── Floor tile pattern ─────────────────────────────────────────────────────
function FloorGrid() {
  const tiles = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 10; col++) {
      const shade = (row + col) % 2 === 0 ? '#0e0b18' : '#0c0915';
      tiles.push(
        <rect key={`${row}-${col}`} x={col * 10} y={row * 10} width="10" height="10" fill={shade} stroke="#1a1228" strokeWidth="0.3"/>
      );
    }
  }
  return <g>{tiles}</g>;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CrewPage() {
  const [order, setOrder] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { cls: 'mut', text: '// Orbit Office — crew on standby.' },
    { cls: 'mut', text: '// Give an order. Agents run it for real on your workspace.' },
  ]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({
    director: 'idle', researcher: 'idle', webdev: 'idle', appdev: 'idle',
  });
  const [activeLogs, setActiveLogs] = useState<Record<string, string>>({});
  const [emotes, setEmotes] = useState<Record<string, string>>({});
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const push = useCallback((l: Line) => setLines(p => [...p, l]), []);

  const setAgent = useCallback((id: string, state: AgentState) => {
    setAgentStates(s => ({ ...s, [id]: state }));
    setEmotes(e => ({ ...e, [id]: EMOTES[state] }));
  }, []);

  async function run(cmd: string) {
    if (running || !cmd.trim()) return;
    setRunning(true);
    setAgent('director', 'thinking');
    setLines([{ cls: 'prompt', text: `> ${cmd}` }]);

    try {
      const res = await fetch('/api/crew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: cmd }),
      });
      if (!res.ok || !res.body) {
        push({ cls: 'warn', text: `Error: ${res.status} ${await res.text()}` });
        setRunning(false); return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const m = part.match(/^data: (.*)$/s);
          if (!m) continue;
          let ev: any; try { ev = JSON.parse(m[1]); } catch { continue; }
          handle(ev);
        }
      }
    } catch (e: any) {
      push({ cls: 'warn', text: `Connection lost: ${String(e?.message || e)}` });
    } finally {
      setRunning(false);
      setAgent('director', 'idle');
      Object.keys(CREW).forEach(k => setAgent(k, 'idle'));
    }
  }

  function handle(ev: any) {
    switch (ev.event) {
      case 'system': push({ cls: 'mut', text: `// ${ev.msg}` }); break;
      case 'agent_start': {
        const id = ev.agent as CrewKey;
        setAgent(id, 'walking');
        setTimeout(() => setAgent(id, 'thinking'), 600);
        setTimeout(() => setAgent(id, 'working'), 1400);
        push({ cls: 'hdr', text: `── ${CREW[id]?.name || id} ──────────────────` });
        if (ev.task) push({ cls: 'mut', text: `// ${ev.task}` });
        setActiveLogs(l => ({ ...l, [id]: ev.task || '' }));
        break;
      }
      case 'director_plan':
        push({ cls: 'info', text: `plan: ${ev.summary}` });
        push({ cls: 'mut', text: `crew: ${(ev.crew || []).map((c: string) => CREW[c as CrewKey]?.name || c).join(', ')}` });
        setAgent('director', 'working');
        break;
      case 'line': push({ cls: ev.cls || 'mut', text: ev.text, agent: ev.agent }); break;
      case 'agent_done': setAgent(ev.agent, 'done'); setTimeout(() => setAgent(ev.agent, 'idle'), 2000); break;
      case 'done': push({ cls: 'ok', text: '✔ Mission complete — crew reported in.' }); push({ cls: 'prompt', text: '> _' }); break;
      case 'error': push({ cls: 'warn', text: `✖ ${ev.msg}` }); break;
    }
  }

  const crews = Object.entries(CREW) as [CrewKey, typeof CREW[CrewKey]][];

  return (
    <div className="orbit-office">
      <style>{OFFICE_CSS}</style>

      {/* ── Header ─────────────────────────────── */}
      <div className="oo-head">
        <div className="oo-logo"><span className="oo-dot" /><span>ORBIT <b>OFFICE</b></span></div>
        <div className="oo-sub">pixel-art workstation · crew runs live on your CRM</div>
        <div className="oo-pill">
          <span className={`oo-led ${running ? 'on' : ''}`} />
          {running ? 'Working…' : 'Standby'}
        </div>
      </div>

      {/* ── Main split ─────────────────────────── */}
      <div className="oo-split">

        {/* ── Office scene ───────────────────── */}
        <div className="oo-scene-wrap">
          <div className="oo-scene-hdr">
            <span className="oo-dots"><i/><i/><i/></span>
            <span className="oo-scene-lbl">orbit-office · floor 1</span>
          </div>
          <div className="oo-scene">
            <svg viewBox="0 0 100 100" className="oo-svg" preserveAspectRatio="xMidYMid meet">
              {/* floor */}
              <FloorGrid />
              {/* walls top */}
              <rect x="0" y="0" width="100" height="4" fill="#100c1a" stroke="#1e1630" strokeWidth="0.5"/>
              <rect x="0" y="4" width="100" height="1" fill="#2a1f3a"/>
              {/* wall art / windows */}
              <PixelWindow x={10} y={0} />
              <PixelWindow x={66} y={0} />
              {/* plants */}
              <PixelPlant x={0} y={40} />
              <PixelPlant x={85} y={40} />
              <PixelPlant x={44} y={82} />

              {/* desks & chairs & agents */}
              {crews.map(([id, c]) => {
                const st = agentStates[id] || 'idle';
                const isRight = c.desk.x > 50;
                const isBottom = c.desk.y > 40;
                return (
                  <g key={id}>
                    <PixelChair x={c.desk.x + (isRight ? 12 : 10)} y={c.desk.y + (isBottom ? -4 : 26)} color={c.color} />
                    <PixelDesk x={c.desk.x} y={c.desk.y} color={c.color} />
                    <PixelAgent
                      x={c.desk.x + (isRight ? 14 : 9)}
                      y={c.desk.y + (isBottom ? -28 : -2)}
                      color={c.color}
                      state={st}
                      avatar={c.avatar}
                    />
                    {/* emote bubble */}
                    {st !== 'idle' && (
                      <g className="emote-bubble" transform={`translate(${c.desk.x + (isRight ? 20 : 16)},${c.desk.y + (isBottom ? -38 : -14)})`}>
                        <rect x="-6" y="-6" width="14" height="12" rx="3" fill="#1a1228" stroke={c.color} strokeWidth="0.7" opacity="0.95"/>
                        <text x="1" y="4" fontSize="7" textAnchor="middle" dominantBaseline="auto">{emotes[id] || EMOTES[st]}</text>
                      </g>
                    )}
                    {/* name label */}
                    <text
                      x={c.desk.x + 17}
                      y={c.desk.y + (isBottom ? 50 : 48)}
                      fontSize="4"
                      fill={c.color}
                      textAnchor="middle"
                      fontFamily="'JetBrains Mono',monospace"
                      opacity="0.9"
                    >{c.name}</text>
                    <text
                      x={c.desk.x + 17}
                      y={c.desk.y + (isBottom ? 55 : 53)}
                      fontSize="3"
                      fill="#665f73"
                      textAnchor="middle"
                      fontFamily="'JetBrains Mono',monospace"
                    >{st.toUpperCase()}</text>
                  </g>
                );
              })}

              {/* center logo / rug */}
              <ellipse cx="50" cy="55" rx="12" ry="7" fill="#1a0e20" stroke="#2a1f3a" strokeWidth="0.5" opacity="0.7"/>
              <text x="50" y="57" fontSize="4" fill="#e8303a" textAnchor="middle" fontFamily="'Rajdhani',sans-serif" fontWeight="700" letterSpacing="0.5">ORBIT</text>
            </svg>

            {/* agent status badges */}
            <div className="oo-badges">
              {crews.map(([id, c]) => (
                <div key={id} className={`oo-badge ${agentStates[id] !== 'idle' ? 'active' : ''}`} style={{'--ac': c.color} as any}>
                  <span className="oo-badge-dot" />
                  <div>
                    <div className="oo-badge-name">{c.name}</div>
                    <div className="oo-badge-role">{c.role}</div>
                  </div>
                  <span className="oo-badge-state">{agentStates[id]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Terminal ───────────────────────── */}
        <div className="oo-term-wrap">
          <div className="oo-scene-hdr">
            <span className="oo-dots"><i/><i/><i/></span>
            <span className="oo-scene-lbl">orbit@crew:~/workspace</span>
          </div>
          <div className="oo-term" ref={termRef}>
            {lines.map((l, i) => (
              <div key={i} className={`oo-ln ${l.cls}`}>{l.text}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Input console ──────────────────────── */}
      <div className="oo-console">
        <div className="oo-console-lbl">// send an order to the crew</div>
        <div className="oo-row">
          <input
            value={order}
            onChange={e => setOrder(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(order); }}
            placeholder="e.g. Create a contact named Alex at TechCorp…"
            disabled={running}
          />
          <button className="oo-run" onClick={() => run(order)} disabled={running}>
            {running ? '…' : 'RUN'}
          </button>
        </div>
        <div className="oo-chips">
          {QUICK.map(q => (
            <button key={q} className="oo-chip" disabled={running} onClick={() => { setOrder(q); run(q); }}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────────────────────────
const OFFICE_CSS = `
:root {
  --red:#e8303a; --rs:#ff5d66; --teal:#37e0c5; --amber:#f4b942;
  --violet:#a78bfa; --green:#36d399; --ink:#eceaf4; --dim:#9a93a8;
  --faint:#665f73; --line:#1e1630; --panel:#0c0915;
}
.orbit-office { color:var(--ink); font-family:'DM Sans',system-ui,sans-serif; }

/* head */
.oo-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.oo-logo { display:flex; align-items:center; gap:8px; font-family:'Rajdhani',sans-serif; font-weight:700; font-size:18px; letter-spacing:.12em; }
.oo-logo b { color:var(--red); }
.oo-dot { width:10px; height:10px; border-radius:50%; background:var(--red); box-shadow:0 0 10px var(--red); display:inline-block; }
.oo-sub { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--faint); letter-spacing:.1em; text-transform:uppercase; }
.oo-pill { margin-left:auto; display:flex; align-items:center; gap:7px; font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--dim); border:1px solid var(--line); padding:5px 10px; border-radius:999px; }
.oo-led { width:7px; height:7px; border-radius:50%; background:#4a3060; }
.oo-led.on { background:var(--green); box-shadow:0 0 8px var(--green); animation:oo-pulse 1.4s infinite; }
@keyframes oo-pulse { 50%{opacity:.5} }

/* split layout */
.oo-split { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media(max-width:780px) { .oo-split { grid-template-columns:1fr; } }

/* panel shell */
.oo-scene-wrap, .oo-term-wrap {
  background:var(--panel); border:1px solid var(--line); border-radius:14px; overflow:hidden;
}
.oo-scene-hdr {
  display:flex; align-items:center; gap:8px; padding:8px 12px;
  border-bottom:1px solid var(--line); background:#0a0812;
}
.oo-dots { display:flex; gap:5px; }
.oo-dots i { width:9px; height:9px; border-radius:50%; display:inline-block; }
.oo-dots i:nth-child(1){background:#ff5f57} .oo-dots i:nth-child(2){background:#febc2e} .oo-dots i:nth-child(3){background:#28c840}
.oo-scene-lbl { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:.1em; }

/* office scene */
.oo-scene { padding:10px; }
.oo-svg { width:100%; image-rendering:pixelated; display:block; }

/* agent animations */
.pixel-agent { transition:transform .4s ease; }
@keyframes oo-type-l { 0%,100%{transform:translateY(0)} 50%{transform:translateY(2px)} }
@keyframes oo-type-r { 0%,100%{transform:translateY(2px)} 50%{transform:translateY(0)} }
@keyframes oo-walk-l { 0%,100%{transform:rotate(-10deg)} 50%{transform:rotate(10deg)} }
@keyframes oo-walk-r { 0%,100%{transform:rotate(10deg)} 50%{transform:rotate(-10deg)} }
@keyframes oo-blink  { 0%,90%,100%{scaleY:1} 95%{transform:scaleY(0.1)} }
@keyframes oo-think1 { 0%,100%{opacity:0;transform:scale(0)} 40%,60%{opacity:1;transform:scale(1)} }
@keyframes oo-think2 { 0%,20%,100%{opacity:0;transform:scale(0)} 60%,80%{opacity:1;transform:scale(1)} }
@keyframes oo-think3 { 0%,40%,100%{opacity:0;transform:scale(0)} 80%,95%{opacity:1;transform:scale(1)} }
.pixel-working .type-l { animation:oo-type-l .3s infinite; transform-origin:center bottom; }
.pixel-working .type-r { animation:oo-type-r .3s infinite; transform-origin:center bottom; }
.pixel-walking .walk-l { animation:oo-walk-l .4s infinite; transform-origin:top center; }
.pixel-walking .walk-r { animation:oo-walk-r .4s infinite; transform-origin:top center; }
.pixel-thinking .eye-blink { animation:oo-blink 2s infinite; }
.think-dot1 { animation:oo-think1 1.2s infinite; }
.think-dot2 { animation:oo-think2 1.2s infinite; }
.think-dot3 { animation:oo-think3 1.2s infinite; }
.emote-bubble { animation:oo-pop .2s ease; }
@keyframes oo-pop { from{transform:scale(0)} to{transform:scale(1)} }

/* agent badges */
.oo-badges { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; }
.oo-badge {
  display:flex; align-items:center; gap:7px;
  background:#0e0b18; border:1px solid var(--line); border-radius:9px; padding:6px 8px;
  transition:border-color .3s;
}
.oo-badge.active { border-color:var(--ac); }
.oo-badge-dot { width:6px; height:6px; border-radius:50%; background:var(--ac,#4a3060); flex-shrink:0; }
.oo-badge.active .oo-badge-dot { box-shadow:0 0 6px var(--ac); animation:oo-pulse 1.4s infinite; }
.oo-badge-name { font-family:'Rajdhani',sans-serif; font-weight:600; font-size:12px; line-height:1; }
.oo-badge-role { font-family:'JetBrains Mono',monospace; font-size:8px; color:var(--faint); text-transform:uppercase; margin-top:1px; }
.oo-badge-state { margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:8px; color:var(--faint); text-transform:uppercase; }
.oo-badge.active .oo-badge-state { color:var(--ac); }

/* terminal */
.oo-term {
  height:clamp(260px,44vh,420px); overflow-y:auto; padding:10px 12px;
  font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.65;
  background:#060410;
}
.oo-term::-webkit-scrollbar{width:6px}
.oo-term::-webkit-scrollbar-thumb{background:#1e1630;border-radius:3px}
.oo-ln { white-space:pre-wrap; word-break:break-word; animation:oo-fade .18s ease; }
@keyframes oo-fade { from{opacity:0} }
.oo-ln.prompt{color:var(--rs)} .oo-ln.ok{color:var(--green)} .oo-ln.warn{color:var(--amber)}
.oo-ln.info{color:var(--teal)} .oo-ln.mut{color:var(--dim)} .oo-ln.hdr{color:var(--faint)}
.oo-ln.cmd{color:var(--ink);font-weight:500}

/* console */
.oo-console { margin-top:14px; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:12px; }
.oo-console-lbl { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px; }
.oo-row { display:flex; gap:8px; }
.oo-row input {
  flex:1; min-width:0; background:#0b0810; border:1px solid #2a1f3a; border-radius:10px;
  color:var(--ink); font-family:'DM Sans',sans-serif; font-size:15px; padding:12px 14px;
}
.oo-row input:focus { outline:none; border-color:var(--red); box-shadow:0 0 0 3px #e8303a1a; }
.oo-run {
  border:none; border-radius:10px; padding:0 18px; cursor:pointer;
  font-family:'Rajdhani',sans-serif; font-weight:700; font-size:15px; letter-spacing:.07em;
  color:#fff; background:linear-gradient(180deg,var(--red),#a4131c);
  box-shadow:0 0 14px #e8303a55;
}
.oo-run:disabled { filter:grayscale(.7) brightness(.6); box-shadow:none; cursor:not-allowed; }
.oo-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
.oo-chip {
  font-size:12px; color:var(--dim); background:#100c1a; border:1px solid #2a1f3a;
  border-radius:999px; padding:6px 12px; cursor:pointer; text-align:left;
}
.oo-chip:hover { border-color:var(--red); color:var(--ink); }
.oo-chip:disabled { opacity:.45; cursor:not-allowed; }
`;
