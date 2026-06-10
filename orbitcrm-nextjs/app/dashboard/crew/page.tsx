'use client';

// app/dashboard/crew/page.tsx — the watchable workstation.

// Streams REAL agent work from /api/crew and renders it like Claude Code:

// a character at a desk on the left, a live terminal on the right.

import { useRef, useState, useEffect } from 'react';

type Line = { cls: string; text: string; agent?: string };

const CREW: Record<string, { name: string; ico: string; sub: string }> = {
  director: { name: 'Director', ico: '🛰️', sub: 'coordinator' },
  researcher: { name: 'Researcher', ico: '🔭', sub: 'intel · analysis' },
  webdev: { name: 'Web Dev', ico: '🌐', sub: 'sites · ui' },
  appdev: { name: 'App Dev', ico: '📱', sub: 'backend · automations' },
};

const QUICK = [
  'Create a contact named Maria Lopez at Brightstar Realty and add a follow-up task',
  'Add an automation: when a contact is created, send a welcome SMS and email',
  'Analyze my pipeline and tell me which leads to prioritize',
  'Draft a lead-capture landing page for Orbit',
];

export default function CrewPage() {
  const [order, setOrder] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { cls: 'mut', text: 'Orbit Workstation — crew on standby.' },
    { cls: 'mut', text: 'Give the crew an order. They run for real on your workspace.' },
  ]);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [lines]);

  function push(l: Line) { setLines((p) => [...p, l]); }

  async function run(cmd: string) {
    if (running || !cmd.trim()) return;
    setRunning(true); setActive('director'); setStatus({});
    setLines([{ cls: 'prompt', text: `orbit ❯ ${cmd}` }]);
    try {
      const res = await fetch('/api/crew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: cmd }),
      });
      if (!res.ok || !res.body) { push({ cls: 'warn', text: `Error: ${res.status} ${await res.text()}` }); setRunning(false); return; }
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
      setRunning(false); setActive(null);
    }
  }

  function handle(ev: any) {
    switch (ev.event) {
      case 'system': push({ cls: 'mut', text: ev.msg }); break;
      case 'agent_start':
        setActive(ev.agent); setStatus((s) => ({ ...s, [ev.agent]: 'work' }));
        push({ cls: 'hdr', text: `── ${CREW[ev.agent]?.name || ev.agent} ─────────────── ` });
        if (ev.task) push({ cls: 'mut', text: `task: ${ev.task}` });
        break;
      case 'director_plan':
        push({ cls: 'info', text: `Plan: ${ev.summary}` });
        push({ cls: 'mut', text: `Crew: ${(ev.crew || []).map((c: string) => CREW[c]?.name || c).join(', ')}` });
        break;
      case 'line': push({ cls: ev.cls || 'mut', text: ev.text, agent: ev.agent }); break;
      case 'agent_done': setStatus((s) => ({ ...s, [ev.agent]: 'done' })); break;
      case 'done': push({ cls: 'ok', text: `✔ ${ev.msg}` }); push({ cls: 'prompt', text: 'orbit ❯ _' }); break;
      case 'error': push({ cls: 'warn', text: `✖ ${ev.msg}` }); break;
    }
  }

  return (
    <div className="crewpage">
      <style>{CSS}</style>
      <div className="chead">
        <div className="mark" /><div>
          <div className="ttl">ORBIT <b>WORKSTATION</b></div>
          <div className="tg">Build crew · runs live on your workspace</div>
        </div>
        <div className="pill"><span className={`d ${running ? 'on' : ''}`} />{running ? 'Working' : 'Ready'}</div>
      </div>
      <div className="split">
        {/* character */}
        <div className="panel">
          <div className="ph"><span className="dots"><i /><i /><i /></span><span className="lbl">Crew · Live</span></div>
          <div className={`studio ${active ? 'working' : 'idle'}`}>
            <svg viewBox="0 0 270 220" preserveAspectRatio="xMidYMax meet">
              <defs>
                <radialGradient id="g" cx="50%" cy="42%" r="60%"><stop offset="0%" stopColor="#ff3b45" stopOpacity=".5" /><stop offset="100%" stopColor="#ff3b45" stopOpacity="0" /></radialGradient>
              </defs>
              <ellipse cx="172" cy="116" rx="72" ry="56" fill="url(#g)" className="glow" />
              <rect x="0" y="190" width="270" height="30" fill="#0c0810" /><rect x="0" y="190" width="270" height="3" fill="#3a2230" />
              <g className="glow">
                <rect x="150" y="74" width="92" height="62" rx="5" fill="#0a0710" stroke="#3a2230" strokeWidth="2" />
                <rect x="161" y="86" width="22" height="3" rx="1.5" fill="#ff5d66" /><rect x="186" y="86" width="30" height="3" rx="1.5" fill="#37e0c5" opacity=".8" />
                <rect x="161" y="94" width="40" height="3" rx="1.5" fill="#9a93a8" opacity=".6" /><rect x="161" y="102" width="16" height="3" rx="1.5" fill="#f4b942" opacity=".8" />
                <rect x="181" y="102" width="34" height="3" rx="1.5" fill="#9a93a8" opacity=".5" /><rect x="161" y="110" width="48" height="3" rx="1.5" fill="#36d399" opacity=".7" />
              </g>
              <g className="torso">
                <rect x="108" y="148" width="54" height="48" rx="10" fill="#140d13" stroke="#2a1822" />
                <path d="M104 196 q31 -32 62 0 Z" fill="#e8303a" />
                <rect x="126" y="166" width="18" height="14" rx="6" fill="#caa48f" />
                <circle cx="135" cy="148" r="20" fill="#d9b29b" />
                <path d="M116 144 q4 -22 19 -22 q15 0 19 22 q-9 -8 -19 -8 q-10 0 -19 8 Z" fill="#1a1320" />
                <circle cx="128" cy="148" r="2" fill="#241a14" /><circle cx="142" cy="148" r="2" fill="#241a14" />
                <path d="M115 146 q0 -26 20 -26 q20 0 20 26" fill="none" stroke="#241620" strokeWidth="3" />
                <rect x="112" y="144" width="6" height="10" rx="3" fill="#e8303a" /><rect x="152" y="144" width="6" height="10" rx="3" fill="#241620" />
              </g>
              <g className="armL"><path d="M118 194 q-14 -16 14 -22" fill="none" stroke="#e8303a" strokeWidth="9" strokeLinecap="round" /><circle cx="133" cy="172" r="4.5" fill="#d9b29b" /></g>
              <g className="armR"><path d="M152 194 q14 -16 -10 -22" fill="none" stroke="#e8303a" strokeWidth="9" strokeLinecap="round" /><circle cx="143" cy="172" r="4.5" fill="#d9b29b" /></g>
              <rect x="112" y="198" width="58" height="11" rx="3" fill="#160e15" stroke="#2a1822" />
            </svg>
            <div className="nameplate"><b>● ON SHIFT</b><span className="who">{active ? CREW[active]?.name + ' working…' : 'Crew on standby'}</span></div>
          </div>
        </div>

        {/* terminal */}
        <div className="panel">
          <div className="ph"><span className="dots"><i /><i /><i /></span><span className="lbl">orbit@crew — ~/orbitcrm</span></div>
          <div className="term" ref={termRef}>
            {lines.map((l, i) => (<div key={i} className={`ln ${l.cls}`}>{l.text}</div>))}
          </div>
        </div>
      </div>

      <div className="crewstrip">
        {Object.keys(CREW).map((k) => (
          <div key={k} className="mb" data-on={status[k] || (active === k ? 'work' : '0')}>
            <div className="ic">{CREW[k].ico}</div>
            <div><div className="mn">{CREW[k].name}</div><div className="ms">{CREW[k].sub}</div></div>
          </div>
        ))}
      </div>

      <div className="console">
        <div className="l">Tell the crew what to build — they run for real</div>
        <div className="row">
          <input value={order} onChange={(e) => setOrder(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(order); }}
            placeholder="e.g. Add a welcome SMS + email automation" disabled={running} />
          <button className="go" onClick={() => run(order)} disabled={running}>{running ? '…' : 'RUN'}</button>
        </div>
        <div className="chips">
          {QUICK.map((q) => (<button key={q} className="chip" disabled={running} onClick={() => { setOrder(q); run(q); }}>{q}</button>))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.crewpage{--red:#e8303a;--rs:#ff5d66;--amber:#f4b942;--teal:#37e0c5;--green:#36d399;--violet:#a78bfa;--ink:#eceaf4;--dim:#9a93a8;--faint:#665f73;--line:#241620;--panel:#0f0b14;color:var(--ink);font-family:'DM Sans',system-ui,sans-serif}
.crewpage .chead{display:flex;align-items:center;gap:11px;margin-bottom:12px}
.crewpage .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(150deg,#1a0e14,#0c0910);border:1px solid #3a2230;display:grid;place-items:center}
.crewpage .mark::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--red);box-shadow:0 0 10px var(--red)}
.crewpage .ttl{font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.12em;font-size:18px}.crewpage .ttl b{color:var(--red)}
.crewpage .tg{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;margin-top:2px}
.crewpage .pill{margin-left:auto;display:flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;color:var(--dim);text-transform:uppercase;border:1px solid var(--line);padding:6px 10px;border-radius:999px}
.crewpage .pill .d{width:7px;height:7px;border-radius:50%;background:#665f73}.crewpage .pill .d.on{background:var(--green);box-shadow:0 0 8px var(--green);animation:cb 1.6s infinite}
.crewpage .split{display:grid;grid-template-columns:1fr 1.3fr;gap:14px}
@media(max-width:760px){.crewpage .split{grid-template-columns:1fr}}
.crewpage .panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.crewpage .ph{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line)}
.crewpage .ph .lbl{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.13em;color:var(--faint);text-transform:uppercase}
.crewpage .dots{display:flex;gap:6px}.crewpage .dots i{width:10px;height:10px;border-radius:50%}
.crewpage .dots i:nth-child(1){background:#ff5f57}.crewpage .dots i:nth-child(2){background:#febc2e}.crewpage .dots i:nth-child(3){background:#28c840}
.crewpage .studio{position:relative;aspect-ratio:4/3.2;background:radial-gradient(120% 80% at 50% 0%,#170d14,#0b0810 60%,#08060c)}
.crewpage .studio svg{position:absolute;inset:0;width:100%;height:100%}
.crewpage .glow{animation:fl 3.5s infinite}@keyframes fl{0%,100%{opacity:.85}50%{opacity:1}}
.crewpage .torso{transform-origin:135px 183px;animation:br 5s ease-in-out infinite}
.crewpage .working .torso{animation:br 3s ease-in-out infinite}
@keyframes br{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
.crewpage .armL{transform-origin:118px 194px}.crewpage .armR{transform-origin:152px 194px}
.crewpage .working .armL{animation:tl .42s infinite}.crewpage .working .armR{animation:tr .42s infinite}
@keyframes tl{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}@keyframes tr{0%,100%{transform:translateY(2.5px)}50%{transform:translateY(0)}}
.crewpage .nameplate{position:absolute;left:12px;bottom:10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}
.crewpage .nameplate b{color:var(--rs)}.crewpage .nameplate .who{display:block;color:var(--ink);font-size:13px;font-family:'Rajdhani',sans-serif;font-weight:600;letter-spacing:.05em;margin-top:2px}
.crewpage .term{height:clamp(300px,46vh,440px);overflow-y:auto;padding:12px 13px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;background:#070509}
.crewpage .term::-webkit-scrollbar{width:7px}.crewpage .term::-webkit-scrollbar-thumb{background:#241620;border-radius:4px}
.crewpage .ln{white-space:pre-wrap;word-break:break-word;animation:fd .2s ease}@keyframes fd{from{opacity:0}}
.crewpage .ln.prompt{color:var(--rs)}.crewpage .ln.cmd{color:var(--ink);font-weight:500}.crewpage .ln.ok{color:var(--green)}
.crewpage .ln.warn{color:var(--amber)}.crewpage .ln.info{color:var(--teal)}.crewpage .ln.mut{color:var(--dim)}.crewpage .ln.hdr{color:var(--faint)}
.crewpage .crewstrip{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.crewpage .mb{flex:1;min-width:120px;display:flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:8px 10px;transition:border-color .3s}
.crewpage .mb .ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font-size:14px;background:#160d13;border:1px solid #34212c;transition:.3s}
.crewpage .mb .mn{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:13px;line-height:1}
.crewpage .mb .ms{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.05em;color:var(--faint);text-transform:uppercase;margin-top:2px}
.crewpage .mb[data-on="work"]{border-color:#7a2630}.crewpage .mb[data-on="work"] .ic{border-color:var(--red);box-shadow:0 0 10px #e8303a55}
.crewpage .mb[data-on="done"]{border-color:#1f6b50}.crewpage .mb[data-on="done"] .ic{border-color:var(--green);box-shadow:0 0 10px #36d39955}
.crewpage .console{margin-top:14px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px}
.crewpage .console .l{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.13em;color:var(--faint);text-transform:uppercase;margin-bottom:8px}
.crewpage .row{display:flex;gap:8px}
.crewpage .row input{flex:1;min-width:0;background:#0b0810;border:1px solid #33212c;border-radius:11px;color:var(--ink);font-family:'DM Sans',sans-serif;font-size:15px;padding:13px}
.crewpage .row input:focus{outline:none;border-color:var(--red);box-shadow:0 0 0 3px #e8303a22}
.crewpage .go{border:none;border-radius:11px;padding:0 18px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;letter-spacing:.07em;color:#fff;background:linear-gradient(180deg,var(--red),#a4131c);box-shadow:0 0 16px #e8303a55}
.crewpage .go:disabled{filter:grayscale(.6) brightness(.7);box-shadow:none;cursor:not-allowed}
.crewpage .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.crewpage .chip{font-size:12px;color:var(--dim);background:#120c16;border:1px solid #2c1c26;border-radius:999px;padding:7px 12px;cursor:pointer;text-align:left}
.crewpage .chip:hover{border-color:var(--red);color:var(--ink)}.crewpage .chip:disabled{opacity:.5;cursor:not-allowed}
@keyframes cb{50%{opacity:.4}}
`;
