/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const AGENTS = [
  { key: 'nova',  name: 'NOVA',  role: 'Director', color: '#f0c96b', dx: 140, dy: 130 },
  { key: 'astra', name: 'ASTRA', role: 'Lead Gen',  color: '#00e5ff', dx: 320, dy: 100 },
  { key: 'orion', name: 'ORION', role: 'Web Dev',   color: '#a78bfa', dx: 520, dy: 115 },
  { key: 'rex',   name: 'REX',   role: 'Sales',     color: '#fb923c', dx: 180, dy: 310 },
  { key: 'luna',  name: 'LUNA',  role: 'App Dev',   color: '#f472b6', dx: 400, dy: 295 },
  { key: 'vera',  name: 'VERA',  role: 'Ops',       color: '#7dd3fc', dx: 640, dy: 320 },
];
const WPT = [{x:120,y:200},{x:250,y:380},{x:390,y:440},{x:550,y:380},{x:700,y:420},{x:820,y:280},{x:700,y:160},{x:500,y:200},{x:300,y:260},{x:150,y:340},{x:450,y:310},{x:620,y:240},{x:350,y:170},{x:80,y:290},{x:760,y:350}];
const MPT = [{x:340,y:220},{x:380,y:240},{x:420,y:220},{x:340,y:260},{x:380,y:280},{x:420,y:260}];
const CHIPS = ['Find 100 businesses that need websites','Build a lead-capture landing page','Add an SMS + email welcome flow','Update sales pipeline + follow-ups','Generate weekly ops report','Full launch: CRM + leads + site'];
const W = 900, H = 480;

export default function OfficePage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const [cmd, setCmd] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('CREW READY');
  const [stats, setStats] = useState({ contacts: 0, deals: 0 });
  const win = typeof window !== 'undefined' ? (window as any) : {};

  useEffect(() => {
    try {
      const sb = createClient();
      Promise.all([
        sb.from('contacts').select('id', { count: 'exact', head: true }),
        sb.from('deals').select('id', { count: 'exact', head: true }),
      ]).then(([c, d]) => setStats({ contacts: c.count ?? 0, deals: d.count ?? 0 })).catch(() => {});
    } catch(_) {}
  }, []);

  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', '0 0 900 480');
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    function el(t: string, a: Record<string,string|number>, par?: Element) { const e = document.createElementNS(NS,t); Object.entries(a).forEach(([k,v])=>e.setAttribute(k,String(v))); (par||svg!).appendChild(e); return e; }
    function elg(par?: Element) { const g=document.createElementNS(NS,'g'); (par||svg!).appendChild(g); return g; }

    el('rect',{x:0,y:0,width:W,height:H,fill:'#030a12'});
    el('rect',{x:0,y:0,width:W,height:52,fill:'#060f1e'});
    el('rect',{x:0,y:50,width:W,height:2,fill:'#0e2840'});
    for(let i=0;i<9;i++) el('rect',{x:i*102,y:2,width:100,height:48,rx:2,fill:'#040c1a',stroke:'#0a1e30','stroke-width':.8});
    for(let i=0;i<5;i++){const cx=90+i*180; el('rect',{x:cx-28,y:44,width:56,height:6,rx:3,fill:'#00e5ff',opacity:.5}); el('ellipse',{cx,cy:120,rx:85,ry:70,fill:'#00e5ff',opacity:.025});}
    el('rect',{x:60,y:6,width:780,height:38,rx:4,fill:'#020810',stroke:'#1a3a5a','stroke-width':1.5});
    for(let i=0;i<110;i++) el('circle',{cx:+(65+Math.random()*770).toFixed(1),cy:+(9+Math.random()*30).toFixed(1),r:Math.random()<.12?1.3:.5,fill:'#fff',opacity:+(.25+Math.random()*.7).toFixed(2)});
    [[180,24,'#00e5ff',.8],[620,28,'#f0c96b',.7],[800,20,'#a78bfa',.75]].forEach(([cx,cy,cf,op])=>el('circle',{cx:+cx,cy:+cy,r:1.8,fill:cf as string,opacity:+op}));
    el('circle',{cx:740,cy:24,r:16,fill:'#122040',opacity:.9}); el('ellipse',{cx:740,cy:24,rx:24,ry:6,fill:'none',stroke:'#3a6090','stroke-width':1.5,opacity:.5});
    el('ellipse',{cx:300,cy:22,rx:80,ry:18,fill:'#00e5ff',opacity:.03}); el('ellipse',{cx:580,cy:20,rx:70,ry:15,fill:'#a78bfa',opacity:.035});
    el('rect',{x:0,y:52,width:W,height:22,fill:'#040c1a'}); el('rect',{x:0,y:74,width:W,height:1,fill:'#0e2840'});
    const SC=['SYS:NOMINAL','ORBIT:STABLE','CREW:6','AI:ONLINE'];const FC=['#00e5ff','#36d399','#f0c96b','#a78bfa'];
    SC.forEach((s,i)=>{const t=el('text',{x:55+i*218,y:67,fill:FC[i],'font-family':"'JetBrains Mono'",'font-size':9.5,opacity:.75}); t.textContent=s;});
    el('rect',{x:0,y:52,width:20,height:H-52,fill:'#04101e',stroke:'#0e2840','stroke-width':.8}); el('rect',{x:W-20,y:52,width:20,height:H-52,fill:'#04101e',stroke:'#0e2840','stroke-width':.8});
    ['#36d399','#f4b942','#00e5ff','#a78bfa','#fb923c','#e8303a'].forEach((c,i)=>el('rect',{x:3,y:90+i*28,width:14,height:4,rx:1,fill:c,opacity:.6}));
    ['#7dd3fc','#f472b6','#fb923c','#a78bfa','#00e5ff','#36d399'].forEach((c,i)=>el('rect',{x:W-17,y:90+i*28,width:14,height:4,rx:1,fill:c,opacity:.6}));
    el('rect',{x:20,y:75,width:W-40,height:H-75,fill:'#030b18'});
    for(let i=0;i<8;i++) el('line',{x1:20,y1:96+i*52,x2:W-20,y2:96+i*52,stroke:'#08192c','stroke-width':.7,opacity:+(1-i*.11).toFixed(2)});
    for(let i=0;i<11;i++) el('line',{x1:20+i*88,y1:75,x2:20+i*88,y2:H,stroke:'#08192c','stroke-width':.5,opacity:.5});
    el('rect',{x:20,y:H-11,width:W-40,height:1.5,fill:'#00e5ff',opacity:.15});
    el('rect',{x:845,y:140,width:32,height:60,rx:2,fill:'#050e1c',stroke:'#0e2840','stroke-width':1});
    for(let i=0;i<8;i++) el('rect',{x:848,y:145+i*7,width:26,height:3,rx:1,fill:i%2?'#00e5ff':'#36d399',opacity:.55});
    [[38,450],[450,458],[860,450]].forEach(([px,py])=>{el('rect',{x:px-4,y:py-2,width:8,height:9,rx:2,fill:'#5a2e10'}); el('circle',{cx:px,cy:py-5,r:7,fill:'#226644'}); el('circle',{cx:px-5,cy:py-1,r:4,fill:'#2a8055'}); el('circle',{cx:px+5,cy:py-1,r:4,fill:'#1e6644'});});
    el('rect',{x:22,y:180,width:70,height:50,rx:2,fill:'#070f1e',stroke:'#1a3050','stroke-width':1.5}); el('rect',{x:26,y:184,width:62,height:40,fill:'#0a1624'});
    el('polyline',{points:'30,218 38,206 46,212 58,198 66,204 76,194',fill:'none',stroke:'#00e5ff','stroke-width':1.5});
    const bbt=el('text',{x:57,y:240,'text-anchor':'middle',fill:'#2a4a6a','font-family':"'Press Start 2P'",'font-size':5}); bbt.textContent='BRIEFING';

    const SCREENS: Record<string,Element[]>={}, GLOWS: Record<string,Element>={};
    function buildDesk(key:string,dx:number,dy:number,color:string){
      const g=elg(svg!);
      el('ellipse',{cx:dx+27,cy:dy+46,rx:14,ry:6,fill:'#05101e',stroke:'#0c2035','stroke-width':1.5},g);
      el('rect',{x:dx,y:dy,width:55,height:24,rx:2,fill:'#08182c',stroke:'#102238','stroke-width':1},g);
      el('rect',{x:dx,y:dy+22,width:55,height:8,rx:1,fill:'#060f20'},g);
      GLOWS[key]=el('rect',{x:dx-4,y:dy-4,width:63,height:36,rx:4,fill:color,opacity:0},g);
      el('rect',{x:dx+4,y:dy+3,width:20,height:14,rx:1,fill:'#020810',stroke:`${color}55`,'stroke-width':1},g);
      SCREENS[key]=[el('rect',{x:dx+5,y:dy+4,width:18,height:12,rx:.5,fill:'#08101c'},g)];
      el('rect',{x:dx+28,y:dy+3,width:20,height:14,rx:1,fill:'#020810',stroke:`${color}44`,'stroke-width':1},g);
      SCREENS[key].push(el('rect',{x:dx+29,y:dy+4,width:18,height:12,rx:.5,fill:'#08101c'},g));
      el('rect',{x:dx+6,y:dy+22,width:32,height:5,rx:1,fill:'#060d1c'},g);
      el('circle',{cx:dx+44,cy:dy+25,r:2,fill:color,opacity:.7},g);
      el('circle',{cx:dx+50,cy:dy+25,r:2,fill:'#36d399',opacity:.6},g);
    }
    AGENTS.forEach(a=>buildDesk(a.key,a.dx,a.dy,a.color));
    function setScreen(name:string,mode:string){
      const arr=SCREENS[name]; if(!arr) return; const g=GLOWS[name];
      if(mode==='work'){arr[0].setAttribute('fill','#e8303a');arr[1].setAttribute('fill','#c02828');g?.setAttribute('opacity','0.1');}
      else if(mode==='done'){arr[0].setAttribute('fill','#1f9f76');arr[1].setAttribute('fill','#147055');g?.setAttribute('opacity','0.07');}
      else{arr[0].setAttribute('fill','#08101c');arr[1].setAttribute('fill','#08101c');g?.setAttribute('opacity','0');}
    }
    function makeAstro(par:Element,color:string,name:string,role:string){
      const g=elg(par); el('ellipse',{cx:0,cy:10,rx:8,ry:2.5,fill:'#000',opacity:.35},g);
      const bl=el('rect',{x:-5,y:5,width:4,height:5,rx:1.5,fill:'#c8d8e8'},g);
      const br=el('rect',{x:1,y:5,width:4,height:5,rx:1.5,fill:'#c8d8e8'},g);
      const body=elg(g);
      el('rect',{x:-5,y:-5,width:10,height:11,rx:4,fill:'#e0eaf4'},body);
      el('rect',{x:-5,y:-1,width:10,height:3,fill:color,opacity:.85},body);
      el('rect',{x:-2,y:-2,width:4,height:3,rx:.8,fill:color},body);
      el('rect',{x:-8,y:-4,width:3,height:7,rx:1.5,fill:'#ccd8e8'},body);
      el('rect',{x:5,y:-4,width:3,height:7,rx:1.5,fill:'#ccd8e8'},body);
      el('ellipse',{cx:-6.5,cy:3,rx:2.5,ry:2,fill:color,opacity:.8},body);
      el('ellipse',{cx:6.5,cy:3,rx:2.5,ry:2,fill:color,opacity:.8},body);
      el('circle',{cx:0,cy:-10,r:6.5,fill:'#eaf2fc'},body);
      el('path',{d:'M-4.5 -11.5 a4.5 4.5 0 0 1 9 0 a4.5 4.5 0 0 1 -9 0Z',fill:'#07101e'},body);
      el('ellipse',{cx:-1.5,cy:-12,rx:2,ry:1.4,fill:color,opacity:.7},body);
      const vglow=el('path',{d:'M-3.5 -11.5 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 -7 0Z',fill:color,opacity:0},body);
      el('line',{x1:0,y1:-17,x2:0,y2:-14,stroke:color,'stroke-width':1.4},body);
      const ant=el('circle',{cx:0,cy:-18,r:2,fill:color,opacity:.85},body);
      const nt=el('text',{x:0,y:22,'text-anchor':'middle',fill:color,'font-family':"'Press Start 2P'",'font-size':5,opacity:.95},g); nt.textContent=name;
      const rt=el('text',{x:0,y:31,'text-anchor':'middle',fill:color,'font-family':"'JetBrains Mono'",'font-size':7.5,opacity:.8},g); rt.textContent=role;
      const zg=elg(g);
      if(!document.getElementById('orb-zzz')){const st=document.createElement('style');st.id='orb-zzz';st.textContent='.ozg text{opacity:0}.ozs .oz1{animation:ozf 2.2s ease-in-out infinite}.ozs .oz2{animation:ozf 2.2s ease-in-out infinite .55s}.ozs .oz3{animation:ozf 2.2s ease-in-out infinite 1.1s}@keyframes ozf{0%{opacity:0;transform:translate(0,0)}30%{opacity:.9}100%{opacity:0;transform:translate(4px,-11px)}}';document.head.appendChild(st);}
      zg.classList.add('ozg');
      const z1=el('text',{x:7,y:-18,fill:'#aaddc8','font-family':"'Press Start 2P'",'font-size':4.5},zg); z1.textContent='z'; z1.classList.add('oz1');
      const z2=el('text',{x:10,y:-22,fill:'#aaddc8','font-family':"'Press Start 2P'",'font-size':5.5},zg); z2.textContent='z'; z2.classList.add('oz2');
      const z3=el('text',{x:13,y:-26,fill:'#aaddc8','font-family':"'Press Start 2P'",'font-size':6.5},zg); z3.textContent='z'; z3.classList.add('oz3');
      return {g,bl,br,body,vglow,ant,zg,color};
    }
    interface Agent{g:Element;bl:Element;br:Element;body:Element;vglow:Element;ant:Element;zg:Element;color:string;x:number;y:number;tx:number;ty:number;state:string;pause:number;phase:number;speed:number;meetIdx:number;key:string;}
    const AG: Record<string,Agent>={};
    AGENTS.forEach((a,i)=>{
      const sx=a.dx+27, sy=a.dy+50;
      const spr=makeAstro(svg!,a.color,a.name,a.role);
      AG[a.key]={...spr,x:sx,y:sy,tx:sx,ty:sy,state:'wander',pause:Math.random()*3,phase:Math.random()*6,speed:28+Math.random()*14,meetIdx:i,key:a.key};
      spr.g.setAttribute('transform',`translate(${sx},${sy})`);
    });
    function deskPos(key:string){const a=AGENTS.find(x=>x.key===key)!; return {x:a.dx+27,y:a.dy+50};}
    function pickWander(a:Agent){const w=WPT[Math.floor(Math.random()*WPT.length)]; a.tx=Math.max(35,Math.min(865,w.x+(Math.random()*30-15))); a.ty=Math.max(90,Math.min(460,w.y+(Math.random()*20-10)));}
    let last=0, raf=0;
    function frame(t:number){
      const dt=Math.min(.05,(t-last)/1000||0); last=t;
      Object.values(AG).forEach(a=>{
        if(a.state==='work'){
          const dp=deskPos(a.key); a.x=dp.x; a.y=dp.y; a.tx=dp.x; a.ty=dp.y;
          a.g.setAttribute('transform',`translate(${a.x.toFixed(1)},${a.y.toFixed(1)})`);
          a.vglow.setAttribute('opacity',String(+(0.4+Math.abs(Math.sin(t/200))*0.5).toFixed(2)));
          a.ant.setAttribute('fill','#e8303a'); a.ant.setAttribute('r','2.5');
          a.zg.classList.remove('ozs'); return;
        }
        if(a.state==='meet'){const m=MPT[a.meetIdx]; a.tx=m.x; a.ty=m.y;}
        const dx=a.tx-a.x, dy=a.ty-a.y, dist=Math.hypot(dx,dy); let moving=dist>1.5;
        if(a.state==='wander'&&dist<=2){if(a.pause<=0)a.pause=0.8+Math.random()*3; else{a.pause-=dt; if(a.pause<=0)pickWander(a);} moving=false;}
        if(moving){const sp=a.speed*dt; a.x+=dx/dist*Math.min(sp,dist); a.y+=dy/dist*Math.min(sp,dist); a.phase+=dt*10; a.body.setAttribute('transform',`translate(0,${+(Math.sin(a.phase)*0.8).toFixed(2)})`); a.bl.setAttribute('y',String(5+Math.sin(a.phase)*2)); a.br.setAttribute('y',String(5-Math.sin(a.phase)*2));}
        else{a.bl.setAttribute('y','5'); a.br.setAttribute('y','5'); a.body.setAttribute('transform','translate(0,0)');}
        a.vglow.setAttribute('opacity','0'); a.ant.setAttribute('fill',a.color); a.ant.setAttribute('r','2');
        if(!moving&&a.state==='wander')a.zg.classList.add('ozs'); else a.zg.classList.remove('ozs');
        a.g.setAttribute('transform',`translate(${a.x.toFixed(1)},${a.y.toFixed(1)})`);
      });
      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    (window as any).__OS={setS:(k:string,s:string)=>{if(AG[k])AG[k].state=s;},pw:(k:string)=>{if(AG[k])pickWander(AG[k]);},scr:setScreen};
    return ()=>cancelAnimationFrame(raf);
  },[]);
  function addRow(html:string){if(!termRef.current)return null;const l=document.createElement('div');l.style.cssText='font-family:JetBrains Mono,monospace;font-size:11.5px;line-height:1.7;padding:1px 0';l.innerHTML=html;termRef.current.appendChild(l);termRef.current.scrollTop=termRef.current.scrollHeight;return l;}
  const C: Record<string,string>={ok:'#36d399',wa:'#f4b942',inf:'#00e5ff',mu:'#5a8aaa',hd:'#2a4a6a',fi:'#a78bfa'};
  function tOut(cls:string,txt:string){addRow(`<span style='color:${C[cls]||'#dff0ff'}'>${txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`);}
  function tw(ms:number){return new Promise<void>(r=>setTimeout(r,ms));}
  async function typeCmd(txt:string){
    const l=addRow('<span style="color:#ff5d66">orbit &#10095; </span><span></span><span style="display:inline-block;width:6px;height:11px;background:#e8303a;vertical-align:-2px;animation:ocur 1s steps(1) infinite"></span>');
    if(!l)return; const sp=l.querySelectorAll('span')[1] as HTMLElement; const cur=l.querySelectorAll('span')[2] as HTMLElement;
    for(let i=0;i<txt.length;i++){sp.textContent+=txt[i]; await tw(9+Math.random()*14);} cur?.remove();
  }
  async function tProg(lbl:string){
    const l=addRow(`<span style='color:#5a8aaa'>${lbl} </span><span></span>`);
    const b=l?.querySelectorAll('span')[1] as HTMLElement;
    const bars=['░'.repeat(10),'▓▓▓'+'░'.repeat(7),'▓'.repeat(6)+'░'.repeat(4),'▓'.repeat(9)+'░','▓'.repeat(10)];
    for(let i=0;i<bars.length;i++){if(b)b.textContent=bars[i]+' '+(i*25)+'%'; termRef.current&&(termRef.current.scrollTop=termRef.current.scrollHeight); await tw(110);}
    if(b)b.innerHTML='▓'.repeat(10)+' <span style="color:#36d399">DONE</span>';
  }
  function route(o:string):string[]{
    const ol=o.toLowerCase(); const s:Record<string,boolean>={};
    if(/research|find|analyz|lead|business|prospect/.test(ol))s.astra=true;
    if(/landing|web|page|site|seo|design|ui/.test(ol))s.orion=true;
    if(/app|automat|backend|api|sms|email|crm|trigger|contact/.test(ol))s.luna=true;
    if(/sales|pipeline|deal|close|quota|follow.?up/.test(ol))s.rex=true;
    if(/ops|report|analytic|metric|kpi|monitor/.test(ol))s.vera=true;
    if(/everything|whole|full|launch|mvp|all/.test(ol)){s.astra=true;s.orion=true;s.luna=true;s.rex=true;s.vera=true;}
    const k=Object.keys(s); return k.length?k:['astra','luna'];
  }
  type Step={c?:string;out?:[string,string][];p?:string;df?:string[]};
  function agSteps(k:string,o:string):Step[]{
    const ol=o.toLowerCase();
    if(k==='astra')return[{c:'orbit leadgen --needs-website',out:[['inf','Scanning…']]},{p:'Filtering'},{out:[['mu','100 biz → pipeline']]},{c:'orbit draft-sms',out:[['ok','✓ SMS drafted']]}];
    if(k==='orion')return /dashboard|ui/.test(ol)?[{c:'orbit ui scaffold',out:[['inf','Generating…']]},{p:'Render'},{df:['dashboard/page.tsx','96','12']}]:[{c:'orbit web new landing',out:[['inf','Scaffolding…']]},{p:'Build'},{df:['landing/page.tsx','124','0']},{out:[['ok','Perf 98 · SEO 100']]}];
    if(k==='luna')return /sms|email|welcome/.test(ol)?[{c:'orbit fn deploy welcome',out:[['inf','Deploying…']]},{p:'Trigger'},{out:[['ok','✓ Confirmed']]}]:[{c:'orbit gen api --contacts',out:[['inf','Scaffolding…']]},{p:'Build'},{out:[['ok','✓ Preview live']]}];
    if(k==='rex')return[{c:'orbit pipeline update --bulk',out:[['inf','Syncing…']]},{p:'Updating'},{out:[['mu','8 deals → Proposal']]},{out:[['ok','✓ 12 follow-ups']]}];
    if(k==='vera')return[{c:'orbit report weekly',out:[['inf','Pulling…']]},{p:'Aggregating'},{out:[['mu','$42k · 68% win']]},{out:[['ok','✓ Alerts set']]}];
    return[];
  }
  async function runAgent(k:string,order:string){
    (window as any).__OS?.setS(k,'work'); (window as any).__OS?.scr(k,'work');
    tOut('hd','── '+k.toUpperCase()+' ──────');
    await tw(500);
    for(const s of agSteps(k,order)){
      if(s.c)await typeCmd(s.c);
      if(s.out)for(const [cl,tx] of s.out){tOut(cl,tx);await tw(220+Math.random()*140);}
      if(s.p)await tProg(s.p);
      if(s.df)addRow(`<span style='color:#a78bfa'>${s.df[0]}</span> <span style='color:#36d399'>++ ${s.df[1]}</span> <span style='color:#ff7a82'>-- ${s.df[2]}</span>`);
      await tw(100);
    }
    (window as any).__OS?.scr(k,'done'); await tw(1800); (window as any).__OS?.scr(k,'idle'); (window as any).__OS?.setS(k,'wander'); (window as any).__OS?.pw(k);
  }
  async function dispatch(order:string){
    if(running||!order.trim())return;
    setRunning(true); setStatus('DISPATCHING');
    tOut('inf','NOVA: all crew to briefing…');
    AGENTS.forEach(a=>(window as any).__OS?.setS(a.key,'meet'));
    await typeCmd('orbit dispatch "'+order+'"'); await tw(1300);
    const crew=route(order);
    tOut('mu','Crew: '+crew.map(k=>k.toUpperCase()).join(', ')); await tw(300);
    AGENTS.forEach(a=>{if(!crew.includes(a.key)&&a.key!=='nova')(window as any).__OS?.setS(a.key,'wander');});
    (window as any).__OS?.setS('nova','wander');
    for(const k of crew){await runAgent(k,order); await tw(150);}
    tOut('ok','✔ Mission complete.'); setStatus('CREW READY'); setRunning(false);
    addRow('<span style="color:#ff5d66">orbit &#10095; </span><span style="display:inline-block;width:6px;height:11px;background:#e8303a;vertical-align:-2px;animation:ocur 1s steps(1) infinite"></span>');
  }
  useEffect(()=>{
    if(!document.getElementById('orb-css')){const s=document.createElement('style');s.id='orb-css';s.textContent='@keyframes ocur{50%{opacity:0}}';document.head.appendChild(s);}
    tOut('mu','Orbit Mission Deck online — 6-agent crew on deck.'); tOut('mu','Crew wanders. Dispatch a mission to lock them in.');
    addRow('<span style="color:#ff5d66">orbit &#10095; </span><span style="display:inline-block;width:6px;height:11px;background:#e8303a;vertical-align:-2px;animation:ocur 1s steps(1) infinite"></span>');
  },[]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,padding:16,background:'#030a12',minHeight:'100vh'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 18px',background:'linear-gradient(180deg,#0a1e36,#040e1c)',borderRadius:8,border:'1px solid #0e2840'}}>
        <div><div style={{fontSize:17,fontWeight:900,letterSpacing:'.15em',color:'#00e5ff',textShadow:'0 0 18px #00e5ff88',fontFamily:'Orbitron,monospace'}}>&#9651; ORBIT</div><div style={{fontSize:8,letterSpacing:'.2em',color:'#5a8aaa',fontFamily:'Orbitron,monospace'}}>MISSION COMMAND VESSEL &middot; DECK A</div></div>
        <div style={{display:'flex',gap:14,alignItems:'center',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>
          {[['#36d399','ENGINES'],['#36d399','SHIELDS'],['#f4b942','COMMS']].map(([c,l])=><span key={l}><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:c,marginRight:4}}/>{l}</span>)}
          <span style={{color:'#00e5ff'}}>{new Date().toLocaleTimeString('en-GB',{hour12:false})} UTC</span>
          <span><span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:running?'#e8303a':'#36d399',marginRight:4}}/>{status}</span>
        </div>
      </div>
      <div style={{display:'flex',gap:16,padding:'6px 14px',background:'#040c1a',border:'1px solid #0e2840',borderRadius:8,fontSize:10,fontFamily:'JetBrains Mono,monospace'}}>
        <span style={{color:'#00e5ff'}}>CONTACTS: {stats.contacts}</span>
        <span style={{color:'#f0c96b'}}>DEALS: {stats.deals}</span>
        <span style={{color:'#36d399'}}>CREW: 6 ACTIVE</span>
        <span style={{color:'#a78bfa'}}>AI: ONLINE</span>
      </div>
      <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #0e2840'}}>
        <svg ref={svgRef} style={{width:'100%',display:'block'}} aria-label='Mission Deck'/>
      </div>
      <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #0e2840'}}>
        <div style={{display:'flex',gap:7,alignItems:'center',padding:'6px 12px',background:'#030d1c',borderBottom:'1px solid #0e2840'}}>
          <span style={{display:'flex',gap:4}}>{['#ff5f57','#febc2e','#28c840'].map(c=><i key={c} style={{width:9,height:9,borderRadius:'50%',background:c,display:'inline-block'}}/>)}</span>
          <span style={{fontSize:9,letterSpacing:'.15em',color:'#2a4a6a',fontFamily:'JetBrains Mono,monospace',textTransform:'uppercase'}}>orbit@crew ~/orbitcrm</span>
        </div>
        <div ref={termRef} style={{height:200,overflowY:'auto',padding:'10px 14px',background:'#020910'}}/>
      </div>
      <div style={{background:'#071628',border:'1px solid #0e2840',borderRadius:8,padding:12}}>
        <div style={{fontSize:7,letterSpacing:'.2em',color:'#2a4a6a',fontFamily:'Orbitron,monospace',textTransform:'uppercase',marginBottom:8}}>Dispatch Order</div>
        <div style={{display:'flex',gap:8}}>
          <input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')dispatch(cmd);}} placeholder='e.g. Find 100 businesses that need websites' disabled={running} style={{flex:1,background:'#020b18',border:'1px solid #0e2840',borderRadius:6,color:'#dff0ff',fontFamily:'JetBrains Mono,monospace',fontSize:13,padding:'10px 12px',outline:'none'}}/>
          <button onClick={()=>dispatch(cmd)} disabled={running} style={{background:'linear-gradient(180deg,#d42030,#8a0f18)',border:'none',borderRadius:6,padding:'0 20px',color:'#fff',fontFamily:'Orbitron,monospace',fontSize:9,fontWeight:700,letterSpacing:'.1em',cursor:running?'not-allowed':'pointer',opacity:running?.6:1}}>DISPATCH</button>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
          {CHIPS.map(q=><button key={q} onClick={()=>{if(!running){setCmd(q);dispatch(q);}}} disabled={running} style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'#5a8aaa',background:'#030c1c',border:'1px solid #0e2840',borderRadius:5,padding:'5px 10px',cursor:running?'not-allowed':'pointer'}}>{q}</button>)}
        </div>
      </div>
    </div>
  );
                              }
