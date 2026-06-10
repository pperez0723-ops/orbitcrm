'use client';
// app/dashboard/crew/page.tsx — Orbit Office
// Canvas game loop. Agents walk between desks, idle-bob, type, think.
// Large flat-art characters matching agent-office visual style.

import { useRef, useState, useEffect, useCallback } from 'react';

type Line   = { cls: string; text: string };
type AState = 'idle' | 'thinking' | 'working' | 'walking' | 'done';

// ── Canvas constants ──────────────────────────────────────────────────────
const W = 640;   // canvas width
const H = 520;   // canvas height

// ── 4 crew desks — exact pixel positions ─────────────────────────────────
const DESKS = [
  { id: 'director',   name: 'Director',     role: 'coordinator',           color: '#e8303a', dx: 100, dy: 80  },
  { id: 'researcher', name: 'Researcher',   role: 'intel · analysis',      color: '#37e0c5', dx: 390, dy: 80  },
  { id: 'webdev',     name: 'Web Dev',      role: 'sites · ui',            color: '#a78bfa', dx: 100, dy: 310 },
  { id: 'appdev',     name: 'App Dev',      role: 'backend · automations', color: '#f4b942', dx: 390, dy: 310 },
];

const QUICK = [
  'Create a contact named Maria Lopez at Brightstar Realty and add a follow-up task',
  'Add an automation: when a contact is created, send a welcome SMS and email',
  'Analyze my pipeline and tell me which leads to prioritize',
  'Draft a lead-capture landing page for Orbit',
];

const EMOTE: Record<AState,string> = {
  idle:'😌', thinking:'💡', working:'💻', walking:'🚶', done:'✅',
};

// ── Wander spots (between desks) ─────────────────────────────────────────
const WANDERS = [
  [270,200],[320,260],[240,300],[350,180],[280,350],[310,140],
];

// ── Agent state ───────────────────────────────────────────────────────────
interface Ag {
  id:string; name:string; role:string; color:string;
  deskX:number; deskY:number;   // where their desk is
  px:number; py:number;         // current pixel pos (character foot)
  tx:number; ty:number;         // walk target
  state:AState;
  bobPh:number;                 // idle bob phase
  walkT:number; walkFr:number;  // walk animation
  typeT:number; typeFr:number;  // typing animation
  emote:string; emoteT:number;
  wanderCD:number;              // countdown to next wander
}

function mkAg(d: typeof DESKS[0]): Ag {
  // character sits in front of desk
  const px = d.dx + 65, py = d.dy + 20;
  return {
    id:d.id, name:d.name, role:d.role, color:d.color,
    deskX:d.dx, deskY:d.dy,
    px, py, tx:px, ty:py,
    state:'idle', bobPh:Math.random()*Math.PI*2,
    walkT:0, walkFr:0, typeT:0, typeFr:0,
    emote:EMOTE.idle, emoteT:0,
    wanderCD: Math.random()*200+100,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DRAWING
// ═══════════════════════════════════════════════════════════════════════

function drawRoom(c: CanvasRenderingContext2D) {
  // Floor — warm grey (agent-office: #2d2d3d)
  c.fillStyle = '#2d2d3d';
  c.fillRect(0, 0, W, H);

  // Inner work floor
  c.fillStyle = '#33334a';
  c.fillRect(20, 20, W-40, H-40);

  // Top-left zone tint (meeting / purple)
  c.fillStyle = 'rgba(53,42,69,0.7)';
  c.fillRect(20, 20, W/2-10, H/2-10);

  // Top-right zone tint (collab / warm)
  c.fillStyle = 'rgba(61,48,37,0.7)';
  c.fillRect(W/2+10, 20, W/2-30, H/2-10);

  // Bottom zone tint (general)
  c.fillStyle = 'rgba(30,30,50,0.4)';
  c.fillRect(20, H/2+10, W-40, H/2-30);

  // Top wall
  c.fillStyle = '#1a1a2e';
  c.fillRect(0, 0, W, 20);
  c.fillStyle = '#2a2a45';
  c.fillRect(0, 18, W, 3);

  // Bottom wall
  c.fillStyle = '#1a1a2e';
  c.fillRect(0, H-20, W, 20);

  // Left wall
  c.fillStyle = '#1e1e30';
  c.fillRect(0, 0, 20, H);

  // Right wall
  c.fillStyle = '#1e1e30';
  c.fillRect(W-20, 0, 20, H);

  // Windows on top wall
  drawWin(c, 60,  2, 80, 16);
  drawWin(c, 260, 2, 80, 16);
  drawWin(c, 480, 2, 80, 16);

  // Horizontal center divider line
  c.strokeStyle = '#2a2a42';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(20, H/2); c.lineTo(W-20, H/2); c.stroke();
  // Vertical center divider
  c.beginPath(); c.moveTo(W/2, 20); c.lineTo(W/2, H-20); c.stroke();

  // Center Orbit rug
  c.save();
  c.fillStyle = 'rgba(108,92,231,0.18)';
  c.beginPath(); c.ellipse(W/2, H/2, 80, 50, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = 'rgba(108,92,231,0.4)';
  c.lineWidth = 2;
  c.beginPath(); c.ellipse(W/2, H/2, 80, 50, 0, 0, Math.PI*2); c.stroke();
  c.font = 'bold 18px "Rajdhani",sans-serif';
  c.fillStyle = '#e8303a';
  c.textAlign = 'center';
  c.fillText('ORBIT', W/2, H/2+6);
  c.restore();

  // Plants
  drawPlant(c, 28, 50);
  drawPlant(c, 28, 280);
  drawPlant(c, W-48, 50);
  drawPlant(c, W-48, 280);
  drawPlant(c, W/2-16, H-52);
}

function drawWin(c: CanvasRenderingContext2D, x:number,y:number,w:number,h:number) {
  c.fillStyle = '#0d1a2e';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#0a2050';
  c.fillRect(x+2, y+2, w/2-3, h-4);
  c.fillStyle = '#0a1a40';
  c.fillRect(x+w/2+1, y+2, w/2-3, h-4);
  // divider
  c.fillStyle = '#1e2a40';
  c.fillRect(x+w/2-1, y, 2, h);
  // stars
  c.fillStyle = 'rgba(255,255,255,0.8)';
  [[x+8,y+4],[x+20,y+6],[x+w/2+8,y+4],[x+w/2+20,y+6]].forEach(([sx,sy])=>{
    c.fillRect(sx,sy,1.5,1.5);
  });
}

function drawPlant(c: CanvasRenderingContext2D, x:number, y:number) {
  // pot
  c.fillStyle = '#6d4c41';
  c.fillRect(x+3, y+16, 14, 12);
  c.fillStyle = '#795548';
  c.fillRect(x+5, y+18, 10, 8);
  // leaves
  c.fillStyle = '#2e7d32';
  c.beginPath(); c.arc(x+10, y+12, 10, 0, Math.PI*2); c.fill();
  c.fillStyle = '#388e3c';
  c.beginPath(); c.arc(x+5,  y+14, 7,  0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(x+15, y+14, 7,  0, Math.PI*2); c.fill();
  c.fillStyle = '#1b5e20';
  c.beginPath(); c.arc(x+10, y+6,  6,  0, Math.PI*2); c.fill();
}

// ── BIG FLAT-ART DESK (matching agent-office style) ───────────────────────
function drawDesk(c: CanvasRenderingContext2D, d: typeof DESKS[0], state: AState, t: number) {
  const {dx,dy,color} = d;
  const W2 = 140, H2 = 70;

  // Desk body — dark with color accent border
  c.fillStyle = '#1e1630';
  roundRect(c, dx, dy+40, W2, H2, 10);
  c.fillStyle = '#241c3a';
  roundRect(c, dx+2, dy+42, W2-4, H2-4, 8);

  // Color accent top edge
  c.fillStyle = color;
  roundRect(c, dx, dy+40, W2, 5, 3);

  // Monitor / screen on desk
  const mw = 88, mh = 58;
  const mx = dx + W2/2 - mw/2, my = dy-10;

  // Screen bezel
  c.fillStyle = '#12101e';
  roundRect(c, mx-4, my-4, mw+8, mh+8, 6);
  // Screen
  c.fillStyle = '#0d1a2e';
  roundRect(c, mx, my, mw, mh, 4);

  // Screen content
  if (state === 'working') {
    const cur = Math.floor(t/400) % 2 === 0;
    // code lines
    c.fillStyle = color + 'dd';
    c.fillRect(mx+6, my+8,  50, 5);
    c.fillStyle = '#37e0c5aa';
    c.fillRect(mx+6, my+17, 35, 5);
    c.fillStyle = '#fdcb6eaa';
    c.fillRect(mx+6, my+26, 45, 5);
    c.fillStyle = '#a78bfaaa';
    c.fillRect(mx+6, my+35, 28, 5);
    c.fillStyle = '#36d399aa';
    c.fillRect(mx+6, my+44, 40, 5);
    if (cur) {
      c.fillStyle = '#fff';
      c.fillRect(mx+6, my+8, 2, 6);
    }
  } else if (state === 'thinking') {
    // Pulsing dots
    for (let i=0;i<3;i++) {
      const phase = ((t/500) + i*0.33) % 1;
      const alpha = Math.sin(phase * Math.PI);
      c.fillStyle = color + Math.floor(alpha*255).toString(16).padStart(2,'0');
      c.beginPath();
      c.arc(mx+20+i*22, my+mh/2, 6+alpha*3, 0, Math.PI*2);
      c.fill();
    }
  } else {
    // Idle — dim lines
    c.fillStyle = color + '40';
    c.fillRect(mx+6, my+10, 40, 4);
    c.fillStyle = '#ffffff20';
    c.fillRect(mx+6, my+20, 55, 4);
    c.fillRect(mx+6, my+30, 32, 4);
  }

  // Monitor stand
  c.fillStyle = '#2a2040';
  c.fillRect(mx+mw/2-4, my+mh, 8, 12);
  c.fillRect(mx+mw/2-12, my+mh+10, 24, 4);

  // Keyboard on desk surface
  c.fillStyle = '#2a2040';
  roundRect(c, dx+10, dy+52, 70, 22, 4);
  c.fillStyle = '#332a50';
  roundRect(c, dx+12, dy+54, 66, 18, 3);
  // Key rows
  c.fillStyle = '#1e1630';
  for (let r=0;r<2;r++) for (let k=0;k<6;k++) {
    c.fillRect(dx+14+k*10, dy+56+r*8, 8, 5);
  }

  // Mouse
  c.fillStyle = '#2a2040';
  roundRect(c, dx+88, dy+56, 20, 16, 6);
  c.fillStyle = '#1a1030';
  c.fillRect(dx+97, dy+56, 1, 8);

  // Desk legs
  c.fillStyle = '#1a1028';
  c.fillRect(dx+8,      dy+105, 10, 10);
  c.fillRect(dx+W2-18,  dy+105, 10, 10);
}

// ── BIG FLAT-ART CHARACTER (like agent-office) ────────────────────────────
function drawChar(c: CanvasRenderingContext2D, ag: Ag, t: number) {
  const bob = ag.state === 'idle' ? Math.sin(t/700 + ag.bobPh) * 3 : 0;
  const x = Math.round(ag.px);
  const y = Math.round(ag.py + bob);
  const col = ag.color;

  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(x, y+70, 28, 8, 0, 0, Math.PI*2);
  c.fill();

  // ── Legs ──────────────────────────────────────────────────────────────
  if (ag.state === 'walking') {
    const sw = Math.sin(t/140) * 10;
    // Left leg
    c.fillStyle = '#2d3436';
    c.fillRect(x-18, y+42, 14, 28+sw);
    // Right leg
    c.fillRect(x+4,  y+42, 14, 28-sw);
    // Feet
    c.fillStyle = '#1a1a1a';
    roundRect(c, x-20, y+68+sw, 17, 8, 3);
    roundRect(c, x+3,  y+60-sw, 17, 8, 3);
  } else {
    c.fillStyle = '#2d3436';
    c.fillRect(x-18, y+42, 14, 26);
    c.fillRect(x+4,  y+42, 14, 26);
    c.fillStyle = '#1a1a1a';
    roundRect(c, x-20, y+66, 17, 8, 3);
    roundRect(c, x+3,  y+66, 17, 8, 3);
  }

  // ── Body (shirt) — BIG rounded rect like agent-office ─────────────────
  c.fillStyle = col;
  roundRect(c, x-22, y+16, 44, 30, 12);

  // ── Arms ──────────────────────────────────────────────────────────────
  if (ag.state === 'working') {
    const ta = ag.typeFr % 2 === 0 ? -4 : 4;
    c.fillStyle = col;
    roundRect(c, x-36, y+18+ta, 16, 22, 8);
    roundRect(c, x+20, y+18-ta, 16, 22, 8);
    // Hands reaching forward
    c.fillStyle = '#deb887';
    c.beginPath(); c.arc(x-28, y+38+ta, 8, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+28, y+38-ta, 8, 0, Math.PI*2); c.fill();
  } else if (ag.state === 'walking') {
    const sw = Math.sin(t/140+Math.PI) * 12;
    c.fillStyle = col;
    roundRect(c, x-36, y+18, 16, 22+sw, 8);
    roundRect(c, x+20, y+18, 16, 22-sw, 8);
    c.fillStyle = '#deb887';
    c.beginPath(); c.arc(x-28, y+40+sw, 8, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+28, y+40-sw, 8, 0, Math.PI*2); c.fill();
  } else {
    c.fillStyle = col;
    roundRect(c, x-36, y+18, 16, 24, 8);
    roundRect(c, x+20, y+18, 16, 24, 8);
    c.fillStyle = '#deb887';
    c.beginPath(); c.arc(x-28, y+42, 8, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+28, y+42, 8, 0, Math.PI*2); c.fill();
  }

  // ── Neck ──────────────────────────────────────────────────────────────
  c.fillStyle = '#deb887';
  roundRect(c, x-8, y+6, 16, 12, 4);

  // ── Head — big round ───────────────────────────────────────────────────
  c.fillStyle = '#deb887';
  c.beginPath(); c.arc(x, y, 26, 0, Math.PI*2); c.fill();

  // Hair (solid dark cap — different per color)
  const hairMap: Record<string,string> = {
    '#e8303a':'#3e1f10','#37e0c5':'#0d3028','#a78bfa':'#1a0d30','#f4b942':'#2e1c00',
  };
  c.fillStyle = hairMap[col] || '#2c1810';
  c.beginPath();
  c.arc(x, y-4, 26, Math.PI, 0);
  c.fill();
  // Side hair
  c.beginPath(); c.arc(x-22, y+2, 10, Math.PI/2, -Math.PI/2); c.fill();

  // ── Eyes ──────────────────────────────────────────────────────────────
  const blink = ag.state === 'thinking' && Math.floor(t/160) % 9 === 0;
  c.fillStyle = '#fff';
  if (!blink) {
    c.beginPath(); c.arc(x-9, y+2, 7, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+9, y+2, 7, 0, Math.PI*2); c.fill();
    c.fillStyle = '#2d3436';
    c.beginPath(); c.arc(x-9, y+3, 4, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+9, y+3, 4, 0, Math.PI*2); c.fill();
    // Pupils
    c.fillStyle = '#000';
    c.beginPath(); c.arc(x-8, y+3, 2, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(x+10, y+3, 2, 0, Math.PI*2); c.fill();
  } else {
    // Blink lines
    c.fillStyle = '#2d3436';
    c.fillRect(x-14, y+3, 11, 2);
    c.fillRect(x+5,  y+3, 11, 2);
  }

  // ── Mouth ─────────────────────────────────────────────────────────────
  c.strokeStyle = ag.state === 'done' ? '#00b894' : '#b0896a';
  c.lineWidth = 2;
  c.beginPath();
  if (ag.state === 'working' || ag.state === 'done') {
    c.arc(x, y+12, 7, 0.1, Math.PI-0.1);
  } else {
    c.moveTo(x-6, y+12); c.lineTo(x+6, y+12);
  }
  c.stroke();
}

// ── Emote bubble ─────────────────────────────────────────────────────────
function drawEmote(c: CanvasRenderingContext2D, ag: Ag) {
  if (ag.state === 'idle' || ag.emoteT <= 0) return;
  const alpha = Math.min(1, ag.emoteT / 40);
  const x = Math.round(ag.px), y = Math.round(ag.py);
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = '#1e1630';
  c.strokeStyle = ag.color;
  c.lineWidth = 2;
  roundRect(c, x-20, y-52, 42, 30, 8);
  c.fill(); c.stroke();
  // tail
  c.beginPath(); c.moveTo(x-4, y-22); c.lineTo(x, y-14); c.lineTo(x+8, y-22); c.fill();
  c.font = '18px serif';
  c.textAlign = 'center';
  c.fillText(ag.emote, x+1, y-30);
  c.restore();
}

// ── roundRect helper ──────────────────────────────────────────────────────
function roundRect(c: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y);
  c.quadraticCurveTo(x+w, y, x+w, y+r);
  c.lineTo(x+w, y+h-r);
  c.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  c.lineTo(x+r, y+h);
  c.quadraticCurveTo(x, y+h, x, y+h-r);
  c.lineTo(x, y+r);
  c.quadraticCurveTo(x, y, x+r, y);
  c.closePath();
  c.fill();
}

// ═══════════════════════════════════════════════════════════════════════
// React Component
// ═══════════════════════════════════════════════════════════════════════
export default function CrewPage() {
  const [order,    setOrder]   = useState('');
  const [running,  setRunning] = useState(false);
  const [lines,    setLines]   = useState<Line[]>([
    { cls:'mut', text:'// Orbit Office — crew on standby.' },
    { cls:'mut', text:'// Send an order below. Agents actually work on your CRM.' },
  ]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const termRef   = useRef<HTMLDivElement>(null);
  const agsRef    = useRef<Ag[]>(DESKS.map(mkAg));
  const sMapRef   = useRef<Record<string,AState>>({
    director:'idle', researcher:'idle', webdev:'idle', appdev:'idle',
  });
  const rafRef  = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const push = useCallback((l:Line) => setLines(p=>[...p,l]), []);

  // ── Game loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    // per-agent wander countdown
    const wcd: Record<string,number> = {};
    DESKS.forEach(d => { wcd[d.id] = Math.random()*200+80; });

    function tick(now: number) {
      const dt = Math.min(now - (lastRef.current||now), 50);
      lastRef.current = now;

      // ── Draw scene ────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      drawRoom(ctx);

      const ags = agsRef.current;

      // Sort by py so lower agents draw on top
      const sorted = [...ags].sort((a,b) => a.py - b.py);

      // Draw all desks first
      DESKS.forEach(d => {
        const ag = ags.find(a=>a.id===d.id)!;
        drawDesk(ctx, d, ag.state, now);
      });

      // Draw agents on top
      sorted.forEach(ag => {
        const assigned = sMapRef.current[ag.id];

        // ── State logic ────────────────────────────────────────────────
        if (assigned === 'working' || assigned === 'thinking') {
          // Move toward own desk seat
          const seat = { x: ag.deskX+65, y: ag.deskY+20 };
          const onDesk = Math.abs(ag.px-seat.x)<6 && Math.abs(ag.py-seat.y)<6;
          if (!onDesk && ag.state !== 'walking') {
            ag.tx = seat.x; ag.ty = seat.y;
            ag.state = 'walking';
            ag.emote = EMOTE.walking; ag.emoteT = 120;
          } else if (onDesk) {
            ag.state = assigned;
            ag.emote = EMOTE[assigned]; ag.emoteT = 999;
          }
        } else if (assigned === 'done') {
          ag.state = 'done'; ag.emote = EMOTE.done; ag.emoteT = 180;
        } else {
          // Idle wander
          wcd[ag.id] -= dt;
          if (wcd[ag.id] <= 0 && ag.state !== 'walking') {
            const [wx,wy] = WANDERS[Math.floor(Math.random()*WANDERS.length)];
            ag.tx = wx; ag.ty = wy;
            ag.state = 'walking';
            ag.emote = EMOTE.walking; ag.emoteT = 100;
            wcd[ag.id] = Math.random()*700+300;
          }
        }

        // ── Move ───────────────────────────────────────────────────────
        const dx = ag.tx - ag.px, dy = ag.ty - ag.py;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist > 2 && ag.state === 'walking') {
          const spd = 1.5;
          ag.px += (dx/dist)*spd*(dt/16);
          ag.py += (dy/dist)*spd*(dt/16);
        } else if (ag.state === 'walking') {
          ag.px = ag.tx; ag.py = ag.ty;
          const next = sMapRef.current[ag.id];
          ag.state = (next==='working'||next==='thinking') ? next : 'idle';
          ag.emote = EMOTE[ag.state]; ag.emoteT = ag.state!=='idle'?999:0;
        }

        // ── Animate ────────────────────────────────────────────────────
        ag.emoteT  = Math.max(0, ag.emoteT - dt);
        ag.typeT  += dt; if (ag.typeT>100){ ag.typeFr++; ag.typeT=0; }
        ag.walkT  += dt; if (ag.walkT>150){ ag.walkFr=(ag.walkFr+1)%4; ag.walkT=0; }

        drawChar(ctx, ag, now);
        drawEmote(ctx, ag);
      });

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function setState(id:string, s:AState) { sMapRef.current[id] = s; }

  // ── SSE streaming ──────────────────────────────────────────────────────
  async function run(cmd:string) {
    if (running || !cmd.trim()) return;
    setRunning(true);
    setState('director','thinking');
    setLines([{ cls:'prompt', text:`orbit > ${cmd}` }]);
    try {
      const res = await fetch('/api/crew',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({order:cmd}),
      });
      if (!res.ok||!res.body){ push({cls:'warn',text:`Error ${res.status}`}); setRunning(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf='';
      while(true){
        const {done,value} = await reader.read();
        if(done) break;
        buf += dec.decode(value,{stream:true});
        const parts = buf.split('\n\n');
        buf = parts.pop()||'';
        for (const part of parts){
          const m = part.match(/^data: (.*)$/s); if(!m) continue;
          let ev:any; try{ev=JSON.parse(m[1]);}catch{continue;}
          onEvent(ev);
        }
      }
    } catch(e:any){ push({cls:'warn',text:`Connection lost: ${e?.message}`}); }
    finally { setRunning(false); DESKS.forEach(d=>setState(d.id,'idle')); }
  }

  function onEvent(ev:any){
    switch(ev.event){
      case 'system': push({cls:'mut',text:`// ${ev.msg}`}); break;
      case 'agent_start': {
        const id = ev.agent as string;
        setState('director','working');
        setTimeout(()=>setState(id,'thinking'),300);
        setTimeout(()=>setState(id,'working'),1800);
        push({cls:'hdr',text:`─── ${DESKS.find(d=>d.id===id)?.name||id} ─────────────────`});
        if(ev.task) push({cls:'mut',text:`// ${ev.task}`});
        break;
      }
      case 'director_plan':
        push({cls:'info',text:`plan: ${ev.summary}`});
        push({cls:'mut',text:`crew: ${(ev.crew||[]).join(', ')}`});
        break;
      case 'line': push({cls:ev.cls||'mut',text:ev.text}); break;
      case 'agent_done': setState(ev.agent,'done'); setTimeout(()=>setState(ev.agent,'idle'),3000); break;
      case 'done': push({cls:'ok',text:'✔ Mission complete — crew reported in.'}); push({cls:'prompt',text:'orbit > _'}); break;
      case 'error': push({cls:'warn',text:`✖ ${ev.msg}`}); break;
    }
  }

  return (
    <div className="oo-root">
      <style>{CSS}</style>

      {/* Header */}
      <div className="oo-hd">
        <span className="oo-hdot" />
        <span className="oo-htitle">ORBIT <b>OFFICE</b></span>
        <span className="oo-hsub">pixel-art workstation · agents run live on your CRM</span>
        <div className="oo-hpill">
          <span className={`oo-hled ${running?'on':''}`}/>
          {running?'Working…':'Standby'}
        </div>
      </div>

      {/* Body: canvas left, terminal right */}
      <div className="oo-body">

        <div className="oo-left">
          <div className="oo-bar">
            <span className="oo-dots"><i/><i/><i/></span>
            <span>ORBIT-OFFICE · FLOOR 1</span>
          </div>
          <div className="oo-cw">
            <canvas ref={canvasRef} width={W} height={H} className="oo-canvas"/>
          </div>
          <div className="oo-roster">
            {DESKS.map(d=>(
              <div key={d.id} className="oo-mb" style={{'--mc':d.color} as any}>
                <span className="oo-mled"/>
                <div>
                  <div className="oo-mname">{d.name}</div>
                  <div className="oo-mrole">{d.role}</div>
                </div>
                <span className="oo-mstate">{sMapRef.current[d.id]||'idle'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="oo-right">
          <div className="oo-bar">
            <span className="oo-dots"><i/><i/><i/></span>
            <span>orbit@crew:~/workspace — live log</span>
          </div>
          <div className="oo-term" ref={termRef}>
            {lines.map((l,i)=><div key={i} className={`oo-ln ${l.cls}`}>{l.text}</div>)}
          </div>
        </div>

      </div>

      {/* Command */}
      <div className="oo-cmd">
        <div className="oo-clbl">// send order to crew</div>
        <div className="oo-crow">
          <input value={order} onChange={e=>setOrder(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')run(order);}}
            placeholder="e.g. Create a contact named Alex at TechCorp with a follow-up task"
            disabled={running}/>
          <button className="oo-run" onClick={()=>run(order)} disabled={running}>
            {running?'…':'RUN'}
          </button>
        </div>
        <div className="oo-chips">
          {QUICK.map(q=>(
            <button key={q} className="oo-chip" disabled={running}
              onClick={()=>{setOrder(q);run(q);}}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
.oo-root{font-family:'DM Sans',system-ui,sans-serif;color:#eceaf4}
/* header */
.oo-hd{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.oo-hdot{width:10px;height:10px;border-radius:50%;background:#e8303a;box-shadow:0 0 10px #e8303a;flex-shrink:0}
.oo-htitle{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px;letter-spacing:.12em}
.oo-htitle b{color:#e8303a}
.oo-hsub{font-family:'JetBrains Mono',monospace;font-size:10px;color:#665f73;letter-spacing:.1em;text-transform:uppercase}
.oo-hpill{margin-left:auto;display:flex;align-items:center;gap:7px;border:1px solid #1e1630;padding:5px 10px;border-radius:999px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#9a93a8}
.oo-hled{width:7px;height:7px;border-radius:50%;background:#4a3060}
.oo-hled.on{background:#36d399;box-shadow:0 0 8px #36d399;animation:oo-pulse 1.4s infinite}
@keyframes oo-pulse{50%{opacity:.4}}
/* layout */
.oo-body{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:820px){.oo-body{grid-template-columns:1fr}}
/* panels */
.oo-left,.oo-right{background:#0c0915;border:1px solid #1e1630;border-radius:14px;overflow:hidden}
.oo-bar{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #1e1630;background:#0a0812;font-family:'JetBrains Mono',monospace;font-size:10px;color:#665f73;text-transform:uppercase;letter-spacing:.08em}
.oo-dots{display:flex;gap:5px}
.oo-dots i{width:9px;height:9px;border-radius:50%;display:inline-block}
.oo-dots i:nth-child(1){background:#ff5f57}
.oo-dots i:nth-child(2){background:#febc2e}
.oo-dots i:nth-child(3){background:#28c840}
/* canvas */
.oo-cw{padding:6px;background:#0c0915}
.oo-canvas{width:100%;height:auto;display:block;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px}
/* roster */
.oo-roster{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px}
.oo-mb{display:flex;align-items:center;gap:7px;background:#0e0b18;border:1px solid #2a1f3a;border-radius:8px;padding:6px 9px}
.oo-mled{width:6px;height:6px;border-radius:50%;background:var(--mc,#4a3060);box-shadow:0 0 5px var(--mc,#4a3060);flex-shrink:0}
.oo-mname{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:12px;line-height:1}
.oo-mrole{font-family:'JetBrains Mono',monospace;font-size:8px;color:#665f73;text-transform:uppercase;margin-top:2px}
.oo-mstate{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:8px;color:#665f73;text-transform:uppercase}
/* terminal */
.oo-term{height:clamp(260px,42vh,420px);overflow-y:auto;padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.65;background:#060410}
.oo-term::-webkit-scrollbar{width:6px}
.oo-term::-webkit-scrollbar-thumb{background:#1e1630;border-radius:3px}
.oo-ln{white-space:pre-wrap;word-break:break-word;animation:oo-fd .18s ease}
@keyframes oo-fd{from{opacity:0}}
.oo-ln.prompt{color:#ff5d66}.oo-ln.ok{color:#36d399}.oo-ln.warn{color:#f4b942}
.oo-ln.info{color:#37e0c5}.oo-ln.mut{color:#9a93a8}.oo-ln.hdr{color:#665f73}.oo-ln.cmd{color:#eceaf4;font-weight:500}
/* command */
.oo-cmd{margin-top:12px;background:#0c0915;border:1px solid #1e1630;border-radius:14px;padding:12px}
.oo-clbl{font-family:'JetBrains Mono',monospace;font-size:10px;color:#665f73;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}
.oo-crow{display:flex;gap:8px}
.oo-crow input{flex:1;min-width:0;background:#0b0810;border:1px solid #2a1f3a;border-radius:10px;color:#eceaf4;font-family:'DM Sans',sans-serif;font-size:15px;padding:12px 14px}
.oo-crow input:focus{outline:none;border-color:#e8303a;box-shadow:0 0 0 3px #e8303a1a}
.oo-run{border:none;border-radius:10px;padding:0 20px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;letter-spacing:.07em;color:#fff;background:linear-gradient(180deg,#e8303a,#a4131c);box-shadow:0 0 14px #e8303a55}
.oo-run:disabled{filter:grayscale(.7) brightness(.6);box-shadow:none;cursor:not-allowed}
.oo-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.oo-chip{font-size:12px;color:#9a93a8;background:#100c1a;border:1px solid #2a1f3a;border-radius:999px;padding:6px 12px;cursor:pointer;text-align:left}
.oo-chip:hover{border-color:#e8303a;color:#eceaf4}
.oo-chip:disabled{opacity:.45;cursor:not-allowed}
`;
