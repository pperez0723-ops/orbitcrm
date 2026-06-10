'use client';
// app/dashboard/crew/page.tsx
// Orbit Workstation — pixel-art office scene, agent-office style.
// Canvas-rendered office with characters that ACTUALLY WALK between desks,
// idle-bob, type, think — using the exact agent-office color palette.

import { useRef, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────
type Line  = { cls: string; text: string };
type AState = 'idle' | 'thinking' | 'working' | 'walking' | 'done';

// ─── Crew config ─────────────────────────────────────────────────────────
const CREW_CONFIG = [
  { id: 'director',   name: 'Director',    role: 'coordinator',          color: '#e8303a', deskGX: 4,  deskGY: 3  },
  { id: 'researcher', name: 'Researcher',  role: 'intel · analysis',     color: '#37e0c5', deskGX: 16, deskGY: 3  },
  { id: 'webdev',     name: 'Web Dev',     role: 'sites · ui',           color: '#a78bfa', deskGX: 4,  deskGY: 14 },
  { id: 'appdev',     name: 'App Dev',     role: 'backend · automations', color: '#f4b942', deskGX: 16, deskGY: 14 },
];

const QUICK = [
  'Create a contact named Maria Lopez at Brightstar Realty and add a follow-up task',
  'Add an automation: when a contact is created, send a welcome SMS and email',
  'Analyze my pipeline and tell me which leads to prioritize',
  'Draft a lead-capture landing page for Orbit',
];

const EMOTES: Record<AState, string> = {
  idle:'😌', thinking:'💡', working:'💻', walking:'🚶', done:'✅',
};

// ─── Canvas renderer ─────────────────────────────────────────────────────
const TILE = 16; // px per grid cell
const COLS = 26;
const ROWS = 22;
const CW   = COLS * TILE; // 416
const CH   = ROWS * TILE; // 352

interface Agent {
  id: string; name: string; role: string; color: string;
  // pixel positions (can be fractional during tween)
  px: number; py: number;
  // target pixel position
  tx: number; ty: number;
  // desk pixel position
  deskPx: number; deskPy: number;
  state: AState;
  emote: string;
  emoteTimer: number;
  // walk cycle frame
  walkFrame: number; walkTimer: number;
  // idle bob
  bobPhase: number;
  // typing frame
  typeFrame: number; typeTimer: number;
}

function makeAgent(cfg: typeof CREW_CONFIG[0]): Agent {
  const px = cfg.deskGX * TILE + 8;
  const py = cfg.deskGY * TILE - 8;
  return {
    id: cfg.id, name: cfg.name, role: cfg.role, color: cfg.color,
    px, py, tx: px, ty: py,
    deskPx: cfg.deskGX * TILE, deskPy: cfg.deskGY * TILE,
    state: 'idle', emote: EMOTES.idle, emoteTimer: 0,
    walkFrame: 0, walkTimer: 0,
    bobPhase: Math.random() * Math.PI * 2,
    typeFrame: 0, typeTimer: 0,
  };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────
function drawOffice(ctx: CanvasRenderingContext2D, t: number) {
  const g = ctx;

  // === FLOOR ===
  // Main warm-grey carpet (agent-office: 0x2d2d3d)
  g.fillStyle = '#2d2d3d';
  g.fillRect(0, 0, CW, CH);

  // Work area (slightly lighter, 0x33334a)
  g.fillStyle = '#33334a';
  g.fillRect(TILE, TILE, CW - TILE * 2, CH - TILE * 2);

  // Meeting room carpet top-left (purple-tinted, 0x352a45)
  g.fillStyle = '#352a45';
  g.fillRect(TILE * 2, TILE * 2, TILE * 8, TILE * 8);

  // Collab area top-right (warm orange, 0x3d3025)
  g.fillStyle = '#3d3025';
  g.fillRect(TILE * 14, TILE * 2, TILE * 8, TILE * 8);

  // Coffee area tiles bottom-right (checkerboard)
  for (let tx = 0; tx < 6; tx++) {
    for (let ty = 0; ty < 6; ty++) {
      g.fillStyle = (tx + ty) % 2 === 0 ? '#2a3a2a' : '#253025';
      g.fillRect(TILE * 17 + tx * TILE, TILE * 14 + ty * TILE, TILE, TILE);
    }
  }

  // === WALLS ===
  // Top wall
  g.fillStyle = '#1a1a2e';
  g.fillRect(0, 0, CW, TILE);
  // Left wall  
  g.fillStyle = '#1e1e30';
  g.fillRect(0, 0, TILE, CH);
  // Right wall
  g.fillRect(CW - TILE, 0, TILE, CH);
  // Bottom wall
  g.fillStyle = '#1a1a2e';
  g.fillRect(0, CH - TILE, CW, TILE);

  // Wall highlight line
  g.strokeStyle = '#2a2a45';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(TILE, TILE); g.lineTo(CW - TILE, TILE); g.stroke();
  g.beginPath(); g.moveTo(TILE, TILE); g.lineTo(TILE, CH - TILE); g.stroke();

  // === WINDOWS on top wall ===
  drawWindow(g, TILE * 3, 2);
  drawWindow(g, TILE * 10, 2);
  drawWindow(g, TILE * 17, 2);

  // === LARGE MEETING TABLE (top-left purple area) ===
  g.fillStyle = '#6d4c2e';
  g.fillRect(TILE * 3, TILE * 3, TILE * 5, TILE * 4);
  g.fillStyle = '#7d5c3e';
  g.fillRect(TILE * 3 + 2, TILE * 3 + 2, TILE * 5 - 4, TILE * 4 - 4);
  // chairs around meeting table
  const mChairs = [
    [TILE*3+8, TILE*3-6],[TILE*3+24, TILE*3-6],[TILE*3+40, TILE*3-6],
    [TILE*3+8, TILE*7+6],[TILE*3+24, TILE*7+6],[TILE*3+40, TILE*7+6],
    [TILE*3-6, TILE*4],[TILE*3-6, TILE*6],
    [TILE*8+6, TILE*4],[TILE*8+6, TILE*6],
  ];
  mChairs.forEach(([cx,cy]) => drawChair(g, cx, cy));
  // Label
  g.font = '8px monospace'; g.fillStyle = '#b8a9d4'; g.textAlign = 'center';
  g.fillText('📋 Meeting Room', TILE * 5 + 8, TILE * 5 + 3);

  // === COLLAB STANDING DESKS (top-right) ===
  g.fillStyle = '#5a3e28';
  g.fillRect(TILE*15, TILE*4, TILE*3, TILE*2);
  g.fillStyle = '#6a4e38';
  g.fillRect(TILE*15+1, TILE*4+1, TILE*3-2, TILE*2-2);
  drawLaptop(g, TILE*15+4, TILE*4+2);

  g.fillStyle = '#5a3e28';
  g.fillRect(TILE*19, TILE*4, TILE*3, TILE*2);
  g.fillStyle = '#6a4e38';
  g.fillRect(TILE*19+1, TILE*4+1, TILE*3-2, TILE*2-2);
  drawLaptop(g, TILE*19+4, TILE*4+2);

  // Bean bags
  g.fillStyle = 'rgba(224,23,85,0.55)';
  g.beginPath(); g.arc(TILE*15+8, TILE*7+8, 9, 0, Math.PI*2); g.fill();
  g.fillStyle = 'rgba(253,203,110,0.55)';
  g.beginPath(); g.arc(TILE*18+8, TILE*8, 9, 0, Math.PI*2); g.fill();
  g.fillStyle = 'rgba(108,197,199,0.55)';
  g.beginPath(); g.arc(TILE*21, TILE*7+8, 9, 0, Math.PI*2); g.fill();

  g.font = '8px monospace'; g.fillStyle = '#e8a87c'; g.textAlign = 'center';
  g.fillText('💡 Collab Area', TILE*18+4, TILE*3+4);

  // === COFFEE AREA ===
  // Counter
  g.fillStyle = '#5a3e28';
  g.fillRect(TILE*17, TILE*20-4, TILE*6, TILE*1+4);
  g.fillStyle = '#6d4c2e';
  g.fillRect(TILE*17+1, TILE*20-3, TILE*6-2, TILE*1+2);
  // Coffee machine
  g.fillStyle = '#2d3436'; g.fillRect(TILE*18, TILE*19-2, TILE*2, TILE+4);
  g.fillStyle = '#636e72'; g.fillRect(TILE*18+1, TILE*19-1, TILE*2-2, TILE+2);
  g.fillStyle = '#d63031';
  g.beginPath(); g.arc(TILE*19, TILE*19+4, 2, 0, Math.PI*2); g.fill();
  // Mugs
  g.fillStyle = '#d63031'; drawMug(g, TILE*17+4, TILE*19+4);
  g.fillStyle = '#00b894'; drawMug(g, TILE*18+4, TILE*19+4);
  g.fillStyle = '#fdcb6e'; drawMug(g, TILE*20+4, TILE*19+4);
  g.font = '8px monospace'; g.fillStyle = '#7fcdaa'; g.textAlign = 'center';
  g.fillText('☕ Coffee & Pantry', TILE*20, TILE*21-2);

  // === PLANTS ===
  drawPlant(g, TILE*2, TILE*11);
  drawPlant(g, TILE*24-4, TILE*11);
  drawPlant(g, TILE*12, TILE*20);

  // === BOOKSHELF right wall ===
  g.fillStyle = '#5a3e28';
  g.fillRect(CW-TILE-1, TILE*3, TILE-2, TILE*7);
  g.fillStyle = '#6d4c2e';
  for (let s = 0; s < 3; s++) {
    g.fillRect(CW-TILE, TILE*3+s*TILE*2+4, TILE-2, 2);
  }
  const bookColors = ['#d63031','#0984e3','#fdcb6e','#00b894','#6c5ce7','#e17055'];
  bookColors.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(CW-TILE, TILE*3+Math.floor(i/3)*TILE*2+6, 3, TILE-2);
  });

  // === CENTER RUG ===
  g.fillStyle = 'rgba(108,92,231,0.18)';
  g.beginPath();
  g.ellipse(TILE*13, TILE*12, TILE*5, TILE*3, 0, 0, Math.PI*2);
  g.fill();
  g.strokeStyle = 'rgba(108,92,231,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(TILE*13, TILE*12, TILE*5, TILE*3, 0, 0, Math.PI*2);
  g.stroke();
  // ORBIT text on rug
  g.font = 'bold 9px "Rajdhani",monospace'; g.fillStyle = '#e8303a';
  g.textAlign = 'center'; g.fillText('ORBIT', TILE*13, TILE*12+3);

  // === PARTITION WALLS (work areas) ===
  g.strokeStyle = '#2a2a42'; g.lineWidth = 2;
  // Horizontal partition
  g.beginPath(); g.moveTo(TILE*11, TILE*2); g.lineTo(TILE*11, TILE*10); g.stroke();
  // Vertical center
  g.beginPath(); g.moveTo(TILE*2, TILE*11); g.lineTo(TILE*24, TILE*11); g.stroke();

  g.textAlign = 'left'; // reset
}

function drawWindow(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#0d1a2e';
  g.fillRect(x, y, TILE*3, TILE-2);
  g.fillStyle = '#0a1528';
  g.fillRect(x+1, y+1, TILE*3-2, TILE-4);
  // frame divider
  g.strokeStyle = '#1e2a40'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x+TILE+5, y+1); g.lineTo(x+TILE+5, y+TILE-3); g.stroke();
  // glow
  g.fillStyle = 'rgba(30,60,160,0.3)';
  g.fillRect(x+1, y+1, TILE+4, TILE-4);
  g.fillStyle = 'rgba(30,60,160,0.3)';
  g.fillRect(x+TILE+6, y+1, TILE*3-TILE-7, TILE-4);
  // stars
  g.fillStyle = 'rgba(255,255,255,0.7)';
  [[x+4,y+3],[x+8,y+2],[x+TILE+8,y+3],[x+TILE*2,y+2]].forEach(([sx,sy]) => {
    g.fillRect(sx, sy, 1, 1);
  });
}

function drawChair(g: CanvasRenderingContext2D, cx: number, cy: number) {
  g.fillStyle = '#4a4a6a';
  g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI*2); g.fill();
  g.fillStyle = '#5a5a7a';
  g.beginPath(); g.arc(cx, cy, 3.5, 0, Math.PI*2); g.fill();
}

function drawLaptop(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#636e72';
  g.fillRect(x, y, TILE-2, TILE-6);
  g.fillStyle = '#2d3436';
  g.fillRect(x+1, y+1, TILE-4, TILE-8);
  g.fillStyle = '#00b894'; // screen glow
  g.fillRect(x+2, y+2, 4, 2);
  g.fillStyle = '#636e72';
  g.fillRect(x-1, y+TILE-6, TILE, 2);
}

function drawPlant(g: CanvasRenderingContext2D, x: number, y: number) {
  // pot
  g.fillStyle = '#8b4513';
  g.fillRect(x+3, y+8, 8, 8);
  g.fillStyle = '#a0522d';
  g.fillRect(x+4, y+9, 6, 6);
  // foliage
  g.fillStyle = '#27ae60';
  g.beginPath(); g.arc(x+7, y+6, 6, 0, Math.PI*2); g.fill();
  g.fillStyle = '#2ecc71';
  g.beginPath(); g.arc(x+4, y+8, 4, 0, Math.PI*2); g.fill();
  g.beginPath(); g.arc(x+10, y+8, 4, 0, Math.PI*2); g.fill();
  g.fillStyle = '#1a9c48';
  g.beginPath(); g.arc(x+7, y+3, 4, 0, Math.PI*2); g.fill();
}

function drawMug(g: CanvasRenderingContext2D, x: number, y: number) {
  const c = g.fillStyle as string;
  g.fillRect(x, y, 4, 5);
  g.strokeStyle = c; g.lineWidth = 1;
  g.beginPath(); g.arc(x+5, y+2, 2, -Math.PI/2, Math.PI/2); g.stroke();
}

// ─── Desk renderer ────────────────────────────────────────────────────────
function drawDesk(g: CanvasRenderingContext2D, px: number, py: number, color: string, state: AState, t: number) {
  const x = px; const y = py;
  // Desk body
  g.fillStyle = '#6d4c2e';
  g.fillRect(x, y, TILE*3, TILE*2);
  g.fillStyle = '#7d5c3e';
  g.fillRect(x+1, y+1, TILE*3-2, TILE*2-2);

  // Monitor
  g.fillStyle = '#1a1a2a';
  g.fillRect(x+6, y-14, TILE*2-4, TILE);
  g.fillStyle = '#2d3436';
  g.fillRect(x+7, y-13, TILE*2-6, TILE-2);

  // Screen content — animated when working
  if (state === 'working') {
    const blink = Math.floor(t / 300) % 2 === 0;
    g.fillStyle = color + 'cc';
    g.fillRect(x+8, y-12, 6, 2);
    g.fillStyle = '#00b894' + '99';
    g.fillRect(x+8, y-9, 10, 2);
    g.fillStyle = '#fdcb6e' + '80';
    g.fillRect(x+8, y-6, 8, 2);
    if (blink) {
      g.fillStyle = '#ffffff';
      g.fillRect(x+18, y-12, 1, 8);
    }
  } else if (state === 'thinking') {
    // Screen shows dots
    for (let d = 0; d < 3; d++) {
      const phase = (t / 400 + d * 0.4) % 1;
      g.fillStyle = color + Math.floor(phase * 200 + 55).toString(16).padStart(2,'0');
      g.beginPath();
      g.arc(x+10+d*5, y-8, 2, 0, Math.PI*2);
      g.fill();
    }
  } else {
    // Idle screen with faint lines
    g.fillStyle = color + '30';
    g.fillRect(x+8, y-12, 6, 2);
    g.fillStyle = '#ffffff15';
    g.fillRect(x+8, y-9, 10, 2);
    g.fillStyle = '#ffffff10';
    g.fillRect(x+8, y-6, 8, 2);
  }

  // Monitor stand
  g.fillStyle = '#4a4a5a';
  g.fillRect(x+TILE-2, y-2, 4, 4);

  // Keyboard
  g.fillStyle = '#b2bec3';
  g.fillRect(x+2, y+4, 14, 6);
  g.fillStyle = '#dfe6e9';
  g.fillRect(x+3, y+5, 12, 4);
  // Keys
  g.fillStyle = '#b2bec3';
  for (let k = 0; k < 4; k++) g.fillRect(x+3+k*3, y+5, 2, 2);
  for (let k = 0; k < 4; k++) g.fillRect(x+3+k*3, y+8, 2, 1);

  // Mouse
  g.fillStyle = '#b2bec3';
  g.fillRect(x+18, y+5, 5, 4);
  g.beginPath(); g.arc(x+20, y+5, 2, Math.PI, 0); g.fill();

  // Notepad
  g.fillStyle = '#ffeaa7';
  g.fillRect(x+TILE*2+2, y+2, 8, 10);
  g.strokeStyle = '#fdcb6e'; g.lineWidth = 0.5;
  [3,5,7,9].forEach(l => {
    g.beginPath(); g.moveTo(x+TILE*2+3, y+l); g.lineTo(x+TILE*2+9, y+l); g.stroke();
  });

  // Coffee mug
  g.fillStyle = '#d63031';
  g.fillRect(x+TILE*2+2, y-6, 5, 5);
  g.strokeStyle = '#d63031'; g.lineWidth = 1;
  g.beginPath(); g.arc(x+TILE*2+8, y-4, 2, -Math.PI/2, Math.PI/2); g.stroke();

  // Color accent line on desk edge
  g.fillStyle = color;
  g.fillRect(x, y, TILE*3, 2);

  // Legs
  g.fillStyle = '#5a3e28';
  g.fillRect(x+2, y+TILE*2, 3, 6);
  g.fillRect(x+TILE*3-5, y+TILE*2, 3, 6);

  // Name label above desk
  g.font = '6px monospace'; g.fillStyle = color; g.textAlign = 'center';
  g.fillText('', x + TILE+7, y+TILE*2+14); // state shown on agent
}

// ─── Character renderer ───────────────────────────────────────────────────
function drawAgent(g: CanvasRenderingContext2D, agent: Agent, t: number) {
  const { px, py, color, state, walkFrame, bobPhase, typeFrame } = agent;

  const bob = state === 'idle' ? Math.sin(t / 600 + bobPhase) * 1.5 : 0;
  const x = Math.round(px);
  const y = Math.round(py + bob);

  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x+4, y+20, 5, 2, 0, 0, Math.PI*2); g.fill();

  // Legs — animated when walking
  if (state === 'walking') {
    const legSwing = Math.sin(t / 120) * 3;
    g.fillStyle = '#2d3436';
    g.fillRect(x+1, y+13, 3, 6 + legSwing);
    g.fillRect(x+5, y+13, 3, 6 - legSwing);
  } else if (state === 'working') {
    // Sitting — legs bent
    g.fillStyle = '#2d3436';
    g.fillRect(x, y+14, 4, 5);
    g.fillRect(x+5, y+14, 4, 5);
    g.fillRect(x, y+19, 5, 2);   // feet left
    g.fillRect(x+4, y+19, 5, 2); // feet right
  } else {
    g.fillStyle = '#2d3436';
    g.fillRect(x+1, y+13, 3, 7);
    g.fillRect(x+5, y+13, 3, 7);
  }

  // Body / shirt
  g.fillStyle = color;
  g.fillRect(x, y+6, 9, 9);

  // Collar / neck
  g.fillStyle = '#deb887';
  g.fillRect(x+3, y+4, 3, 4);

  // Arms — animated when typing
  if (state === 'working') {
    const typeSwing = typeFrame % 2 === 0 ? -2 : 2;
    g.fillStyle = color;
    g.fillRect(x-2, y+7, 3, 7);
    g.fillRect(x+8, y+7, 3, 7);
    // hands forward (typing)
    g.fillStyle = '#deb887';
    g.fillRect(x-3, y+8+typeSwing, 3, 3);
    g.fillRect(x+9, y+8-typeSwing, 3, 3);
  } else if (state === 'walking') {
    const armSwing = Math.sin(t / 120 + Math.PI) * 4;
    g.fillStyle = color;
    g.fillRect(x-2, y+7, 3, 5+armSwing);
    g.fillRect(x+8, y+7, 3, 5-armSwing);
    g.fillStyle = '#deb887';
    g.fillRect(x-2, y+12+armSwing, 3, 3);
    g.fillRect(x+8, y+12-armSwing, 3, 3);
  } else {
    g.fillStyle = color;
    g.fillRect(x-2, y+7, 3, 7);
    g.fillRect(x+8, y+7, 3, 7);
    g.fillStyle = '#deb887';
    g.fillRect(x-2, y+14, 3, 3);
    g.fillRect(x+8, y+14, 3, 3);
  }

  // Head
  g.fillStyle = '#deb887';
  g.fillRect(x+1, y-2, 7, 8);

  // Hair (different per agent — based on color)
  const hairColors: Record<string, string> = {
    '#e8303a': '#2c1810', '#37e0c5': '#0d3028',
    '#a78bfa': '#1e1040', '#f4b942': '#3a2800',
  };
  g.fillStyle = hairColors[color] || '#2c1810';
  g.fillRect(x+1, y-2, 7, 4);
  g.fillRect(x+1, y-2, 2, 7); // side hair

  // Eyes — blink when thinking
  const blink = state === 'thinking' && Math.floor(t / 150) % 8 === 0;
  g.fillStyle = '#2d3436';
  if (blink) {
    g.fillRect(x+2, y+2, 2, 1);
    g.fillRect(x+5, y+2, 2, 1);
  } else {
    g.fillRect(x+2, y+2, 2, 2);
    g.fillRect(x+5, y+2, 2, 2);
  }

  // Mouth
  g.fillStyle = state === 'done' ? '#00b894' : '#c0956b';
  g.fillRect(x+3, y+5, 3, 1);

  // Name tag
  g.font = 'bold 6px monospace';
  g.fillStyle = color;
  g.textAlign = 'center';
  g.fillText(agent.name, x+4, y+25);

  // State indicator
  g.font = '5px monospace';
  g.fillStyle = state === 'idle' ? '#636e72' : '#ffffff';
  g.fillText(state.toUpperCase(), x+4, y+31);
}

// ─── Emote bubble ─────────────────────────────────────────────────────────
function drawEmote(g: CanvasRenderingContext2D, agent: Agent) {
  if (agent.state === 'idle' || agent.emoteTimer <= 0) return;
  const x = Math.round(agent.px) + 4;
  const y = Math.round(agent.py) - 16;
  const alpha = Math.min(1, agent.emoteTimer / 60);

  g.save();
  g.globalAlpha = alpha;
  // bubble bg
  g.fillStyle = '#1e1e30';
  g.strokeStyle = agent.color;
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x-8, y-12, 18, 14, 4);
  g.fill(); g.stroke();
  // tail
  g.fillStyle = '#1e1e30';
  g.beginPath(); g.moveTo(x-2, y+2); g.lineTo(x, y+6); g.lineTo(x+4, y+2); g.fill();
  g.strokeStyle = agent.color;
  g.beginPath(); g.moveTo(x-2, y+2); g.lineTo(x, y+6); g.lineTo(x+4, y+2); g.stroke();
  // emoji
  g.font = '9px serif';
  g.textAlign = 'center';
  g.fillText(agent.emote, x+1, y-1);
  g.restore();
}

// ─── Walk target logic ────────────────────────────────────────────────────
const WANDER_SPOTS = [
  [TILE*5, TILE*12],[TILE*12, TILE*5],[TILE*13, TILE*12],[TILE*18, TILE*12],
  [TILE*8, TILE*8],[TILE*6, TILE*15],[TILE*14, TILE*17],[TILE*10, TILE*18],
];

function randomWanderTarget() {
  return WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)];
}

// ─── Main React component ─────────────────────────────────────────────────
export default function CrewPage() {
  const [order, setOrder]   = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines]   = useState<Line[]>([
    { cls: 'mut', text: '// Orbit Office — crew on standby.' },
    { cls: 'mut', text: '// Give an order below. Agents run it for real on your CRM.' },
  ]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const termRef   = useRef<HTMLDivElement>(null);
  const agentsRef = useRef<Agent[]>(CREW_CONFIG.map(makeAgent));
  const stateMapRef = useRef<Record<string, AState>>({
    director:'idle', researcher:'idle', webdev:'idle', appdev:'idle',
  });
  const rafRef    = useRef<number>(0);
  const lastTRef  = useRef<number>(0);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  const push = useCallback((l: Line) => setLines(p => [...p, l]), []);

  // ── Game loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // idle random wander timer
    const wanderTimers: Record<string, number> = {};
    CREW_CONFIG.forEach(c => { wanderTimers[c.id] = Math.random() * 300 + 120; });

    function tick(now: number) {
      const dt = Math.min(now - (lastTRef.current || now), 50);
      lastTRef.current = now;
      const t = now;

      ctx.clearRect(0, 0, CW, CH);
      drawOffice(ctx, t);

      const agents = agentsRef.current;

      agents.forEach(agent => {
        const assignedState = stateMapRef.current[agent.id];

        // ── State machine ──────────────────────────────────────────────
        if (assignedState === 'working' || assignedState === 'thinking') {
          // Assigned to work: move to desk if not there
          const distX = agent.deskPx + 8 - agent.tx;
          const distY = agent.deskPy - 4  - agent.ty;
          if (Math.abs(distX) > 4 || Math.abs(distY) > 4) {
            agent.tx = agent.deskPx + 8;
            agent.ty = agent.deskPy - 4;
            agent.state = 'walking';
            agent.emote = EMOTES.walking;
            agent.emoteTimer = 120;
          } else {
            agent.state = assignedState;
            agent.emote = EMOTES[assignedState];
            agent.emoteTimer = 999;
          }
        } else if (assignedState === 'done') {
          agent.state = 'done';
          agent.emote = EMOTES.done;
          agent.emoteTimer = 180;
        } else {
          // Idle — wander randomly
          wanderTimers[agent.id] -= dt;
          if (wanderTimers[agent.id] <= 0) {
            const [wx, wy] = randomWanderTarget();
            agent.tx = wx;
            agent.ty = wy;
            agent.state = 'walking';
            agent.emote = EMOTES.walking;
            agent.emoteTimer = 100;
            wanderTimers[agent.id] = Math.random() * 800 + 400;
          }
        }

        // ── Move toward target ─────────────────────────────────────────
        const dx = agent.tx - agent.px;
        const dy = agent.ty - agent.py;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 1) {
          const speed = agent.state === 'walking' ? 1.4 : 0;
          agent.px += (dx / dist) * speed * (dt / 16);
          agent.py += (dy / dist) * speed * (dt / 16);
          if (dist < 2) { agent.px = agent.tx; agent.py = agent.ty; }
        } else if (agent.state === 'walking') {
          // Arrived — switch to assigned or idle
          const aState = stateMapRef.current[agent.id];
          agent.state = (aState === 'working' || aState === 'thinking') ? aState : 'idle';
          agent.emote = EMOTES[agent.state];
          agent.emoteTimer = agent.state !== 'idle' ? 999 : 0;
        }

        // ── Animate frames ─────────────────────────────────────────────
        agent.emoteTimer = Math.max(0, agent.emoteTimer - dt);

        agent.typeTimer += dt;
        if (agent.typeTimer > 120) { agent.typeFrame++; agent.typeTimer = 0; }

        agent.walkTimer += dt;
        if (agent.walkTimer > 150) { agent.walkFrame = (agent.walkFrame+1)%4; agent.walkTimer = 0; }

        // ── Draw desk for this agent ────────────────────────────────────
        drawDesk(ctx, agent.deskPx, agent.deskPy, agent.color, agent.state, t);

        // ── Draw agent ─────────────────────────────────────────────────
        drawAgent(ctx, agent, t);
        drawEmote(ctx, agent);
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Update agent states when SSE events arrive ─────────────────────────
  function setAgentState(id: string, state: AState) {
    stateMapRef.current[id] = state;
  }

  // ── SSE handler ────────────────────────────────────────────────────────
  async function run(cmd: string) {
    if (running || !cmd.trim()) return;
    setRunning(true);
    setAgentState('director', 'thinking');
    setLines([{ cls: 'prompt', text: `orbit > ${cmd}` }]);

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
          handleEvent(ev);
        }
      }
    } catch (e: any) {
      push({ cls: 'warn', text: `Connection lost: ${String(e?.message || e)}` });
    } finally {
      setRunning(false);
      CREW_CONFIG.forEach(c => setAgentState(c.id, 'idle'));
    }
  }

  function handleEvent(ev: any) {
    switch (ev.event) {
      case 'system': push({ cls: 'mut', text: `// ${ev.msg}` }); break;
      case 'agent_start': {
        const id = ev.agent as string;
        setAgentState('director', 'working');
        setTimeout(() => setAgentState(id, 'thinking'), 200);
        setTimeout(() => setAgentState(id, 'working'), 1800);
        push({ cls: 'hdr', text: `─── ${CREW_CONFIG.find(c=>c.id===id)?.name || id} ───────────────────` });
        if (ev.task) push({ cls: 'mut', text: `// ${ev.task}` });
        break;
      }
      case 'director_plan':
        push({ cls: 'info', text: `plan: ${ev.summary}` });
        push({ cls: 'mut', text: `crew: ${(ev.crew||[]).join(', ')}` });
        break;
      case 'line': push({ cls: ev.cls||'mut', text: ev.text }); break;
      case 'agent_done': setAgentState(ev.agent, 'done'); setTimeout(()=>setAgentState(ev.agent,'idle'),3000); break;
      case 'done': push({ cls:'ok', text:'✔ Mission complete — crew reported in.' }); push({cls:'prompt',text:'orbit > _'}); break;
      case 'error': push({ cls:'warn', text:`✖ ${ev.msg}` }); break;
    }
  }

  return (
    <div className="orb-wrap">
      <style>{CSS}</style>

      {/* Header */}
      <div className="orb-head">
        <div className="orb-logo"><span className="orb-dot" />ORBIT <b>OFFICE</b></div>
        <div className="orb-tagline">pixel-art workstation · agents run live on your CRM</div>
        <div className="orb-status">
          <span className={`orb-led ${running ? 'on' : ''}`} />
          {running ? 'Working…' : 'Standby'}
        </div>
      </div>

      {/* Main layout */}
      <div className="orb-body">

        {/* Office canvas */}
        <div className="orb-office-panel">
          <div className="orb-panel-bar">
            <span className="orb-dots"><i/><i/><i/></span>
            <span>orbit-office · floor 1 · agents roaming</span>
          </div>
          <div className="orb-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="orb-canvas"
            />
          </div>
          {/* Agent roster */}
          <div className="orb-roster">
            {CREW_CONFIG.map(c => (
              <div key={c.id} className="orb-member" style={{'--mc': c.color} as any}>
                <span className="orb-member-dot" />
                <div>
                  <div className="orb-member-name">{c.name}</div>
                  <div className="orb-member-role">{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal */}
        <div className="orb-term-panel">
          <div className="orb-panel-bar">
            <span className="orb-dots"><i/><i/><i/></span>
            <span>orbit@crew:~/workspace — live log</span>
          </div>
          <div className="orb-term" ref={termRef}>
            {lines.map((l,i) => <div key={i} className={`orb-ln ${l.cls}`}>{l.text}</div>)}
          </div>
        </div>
      </div>

      {/* Command input */}
      <div className="orb-cmd">
        <div className="orb-cmd-label">// send order to crew</div>
        <div className="orb-cmd-row">
          <input
            value={order}
            onChange={e => setOrder(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') run(order); }}
            placeholder="e.g. Create a contact named Alex at TechCorp and add a follow-up task"
            disabled={running}
          />
          <button className="orb-run" onClick={()=>run(order)} disabled={running}>
            {running ? '…' : 'RUN'}
          </button>
        </div>
        <div className="orb-chips">
          {QUICK.map(q => (
            <button key={q} className="orb-chip" disabled={running}
              onClick={()=>{ setOrder(q); run(q); }}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────
const CSS = `
  .orb-wrap { font-family:'DM Sans',system-ui,sans-serif; color:#eceaf4; }
  /* head */
  .orb-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
  .orb-logo { font-family:'Rajdhani',sans-serif; font-weight:700; font-size:18px; letter-spacing:.12em; display:flex; align-items:center; gap:8px; }
  .orb-logo b { color:#e8303a; }
  .orb-dot { width:10px; height:10px; border-radius:50%; background:#e8303a; box-shadow:0 0 10px #e8303a; flex-shrink:0; display:inline-block; }
  .orb-tagline { font-family:'JetBrains Mono',monospace; font-size:10px; color:#665f73; letter-spacing:.1em; text-transform:uppercase; }
  .orb-status { margin-left:auto; display:flex; align-items:center; gap:7px; border:1px solid #1e1630; padding:5px 10px; border-radius:999px; font-family:'JetBrains Mono',monospace; font-size:10px; color:#9a93a8; }
  .orb-led { width:7px; height:7px; border-radius:50%; background:#4a3060; }
  .orb-led.on { background:#36d399; box-shadow:0 0 8px #36d399; animation:led-pulse 1.4s infinite; }
  @keyframes led-pulse { 50%{opacity:.4} }
  /* layout */
  .orb-body { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media(max-width:800px){ .orb-body { grid-template-columns:1fr; } }
  /* panels */
  .orb-office-panel, .orb-term-panel { background:#0c0915; border:1px solid #1e1630; border-radius:14px; overflow:hidden; }
  .orb-panel-bar { display:flex; align-items:center; gap:8px; padding:7px 12px; border-bottom:1px solid #1e1630; background:#0a0812; font-family:'JetBrains Mono',monospace; font-size:10px; color:#665f73; text-transform:uppercase; letter-spacing:.08em; }
  .orb-dots { display:flex; gap:5px; }
  .orb-dots i { width:9px; height:9px; border-radius:50%; display:inline-block; }
  .orb-dots i:nth-child(1){ background:#ff5f57; }
  .orb-dots i:nth-child(2){ background:#febc2e; }
  .orb-dots i:nth-child(3){ background:#28c840; }
  /* canvas */
  .orb-canvas-wrap { padding:8px; background:#0c0915; }
  .orb-canvas { width:100%; height:auto; display:block; image-rendering:pixelated; image-rendering:crisp-edges; border-radius:6px; border:1px solid #1e1630; }
  /* roster */
  .orb-roster { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:8px; }
  .orb-member { display:flex; align-items:center; gap:7px; background:#0e0b18; border:1px solid #2a1f3a; border-radius:8px; padding:6px 8px; }
  .orb-member-dot { width:6px; height:6px; border-radius:50%; background:var(--mc,#4a3060); flex-shrink:0; box-shadow:0 0 4px var(--mc,#4a3060); }
  .orb-member-name { font-family:'Rajdhani',sans-serif; font-weight:600; font-size:12px; line-height:1; color:#eceaf4; }
  .orb-member-role { font-family:'JetBrains Mono',monospace; font-size:8px; color:#665f73; text-transform:uppercase; margin-top:2px; }
  /* terminal */
  .orb-term { height:clamp(260px,42vh,400px); overflow-y:auto; padding:10px 12px; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.65; background:#060410; }
  .orb-term::-webkit-scrollbar{ width:6px; }
  .orb-term::-webkit-scrollbar-thumb{ background:#1e1630; border-radius:3px; }
  .orb-ln { white-space:pre-wrap; word-break:break-word; animation:ln-fade .18s ease; }
  @keyframes ln-fade { from{opacity:0} }
  .orb-ln.prompt{ color:#ff5d66; }
  .orb-ln.ok    { color:#36d399; }
  .orb-ln.warn  { color:#f4b942; }
  .orb-ln.info  { color:#37e0c5; }
  .orb-ln.mut   { color:#9a93a8; }
  .orb-ln.hdr   { color:#665f73; }
  .orb-ln.cmd   { color:#eceaf4; font-weight:500; }
  /* command */
  .orb-cmd { margin-top:12px; background:#0c0915; border:1px solid #1e1630; border-radius:14px; padding:12px; }
  .orb-cmd-label { font-family:'JetBrains Mono',monospace; font-size:10px; color:#665f73; text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px; }
  .orb-cmd-row { display:flex; gap:8px; }
  .orb-cmd-row input { flex:1; min-width:0; background:#0b0810; border:1px solid #2a1f3a; border-radius:10px; color:#eceaf4; font-family:'DM Sans',sans-serif; font-size:15px; padding:12px 14px; }
  .orb-cmd-row input:focus { outline:none; border-color:#e8303a; box-shadow:0 0 0 3px #e8303a1a; }
  .orb-run { border:none; border-radius:10px; padding:0 20px; cursor:pointer; font-family:'Rajdhani',sans-serif; font-weight:700; font-size:15px; letter-spacing:.07em; color:#fff; background:linear-gradient(180deg,#e8303a,#a4131c); box-shadow:0 0 14px #e8303a55; }
  .orb-run:disabled { filter:grayscale(.7) brightness(.6); box-shadow:none; cursor:not-allowed; }
  .orb-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
  .orb-chip { font-size:12px; color:#9a93a8; background:#100c1a; border:1px solid #2a1f3a; border-radius:999px; padding:6px 12px; cursor:pointer; text-align:left; }
  .orb-chip:hover { border-color:#e8303a; color:#eceaf4; }
  .orb-chip:disabled { opacity:.45; cursor:not-allowed; }
`;
