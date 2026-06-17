'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const ORBITS: Record<string,{rx:number;ry:number}> = {
  'New Lead':   {rx:70,  ry:40},
  'SMS Drafted':{rx:132, ry:74},
  'Contacted':  {rx:194, ry:108},
  'Replied':    {rx:256, ry:142},
  'Won':        {rx:318, ry:176},
};
const GEMCOLS: Record<string,string> = {
  'New Lead':'#37e0c5','SMS Drafted':'#F4B942','Contacted':'#A78BFA','Replied':'#5fd0ff','Won':'#36d399',
};
const STAGE_COLORS: Record<string,string> = {
  'New Lead':'#37e0c5','SMS Drafted':'#F4B942','Contacted':'#A78BFA','Replied':'#5fd0ff','Won':'#36d399',
};
const ORBIT_KEYS = ['New Lead','SMS Drafted','Contacted','Replied','Won'];

const FN_URL = 'https://jlbnieorltkfezixulxc.supabase.co/functions/v1/add-lead';
const FN_SECRET = 'whk_orbit_9f3c1a7e8b2d4056aa1199ccee';

type Deal = {name:string;company:string;value:number;status:string};
type Totals = Record<string,{count:number;value:number}>;

interface Props {
  initialDeals: Deal[];
  stages: {id:string;name:string;color:string|null;is_won:boolean;is_lost:boolean;sort_order:number}[];
  workspaceId: string;
  pipelineId: string|null;
}

function gemSVG(fill:string, stage:string, idx:number): string {
  const uid = stage.replace(/\s/g,'') + idx;
  return `<svg viewBox="0 0 40 40" width="40" height="40"><defs><filter id="gf${uid}"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><polygon points="20,3 36,14 30,36 10,36 4,14" fill="${fill}" opacity=".14" stroke="${fill}" stroke-width="1.2" filter="url(#gf${uid})"/><polygon points="20,7 33,16 27,33 13,33 7,16" fill="${fill}" opacity=".32"/><polygon points="20,11 29,19 25,30 15,30 11,19" fill="${fill}" opacity=".75"/><polygon points="20,16 27,22 24,29 16,29 13,22" fill="rgba(255,255,255,0.3)"/></svg>`;
}

function fmt(v:number):string { return v>=1000 ? '$'+(v/1000).toFixed(1)+'K' : '$'+v.toFixed(0); }

export default function OrbitalPipeline({ initialDeals, workspaceId, pipelineId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const gemAnimRef = useRef<number>(0);
  const tRef = useRef(0);
  const gemTRef = useRef(0);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [totals, setTotals] = useState<Totals>(() => {
    const t: Totals = {};
    ORBIT_KEYS.forEach(k => { t[k] = {count:0,value:0}; });
    initialDeals.forEach(d => { if(t[d.status]) { t[d.status].count++; t[d.status].value += d.value; } });
    return t;
  });
  const [filter, setFilter] = useState('all');
  const [clock, setClock] = useState('--:--:--');
  const [modal, setModal] = useState(false);
  const [ldName, setLdName] = useState('');
  const [ldPhone, setLdPhone] = useState('');
  const [ldCat, setLdCat] = useState('');
  const [ldValue, setLdValue] = useState(500);
  const [ldStage, setLdStage] = useState('New Lead');
  const [ldMsg, setLdMsg] = useState('');
  const [ldSaving, setLdSaving] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-US',{hour12:false})),1000);
    setClock(new Date().toLocaleTimeString('en-US',{hour12:false}));
    return () => clearInterval(t);
  }, []);

  const stageDeals = useRef<Record<string,Deal[]>>({});

  const renderNodes = useCallback(() => {
    const wrap = wrapRef.current;
    const container = nodesRef.current;
    if (!wrap || !container) return;
    const W = wrap.offsetWidth, H = wrap.offsetHeight;
    const s = Math.min(W/800, H/480);
    const offX = (W-800*s)/2, offY = (H-480*s)/2;
    const cx = 400, cy = 250;
    // update astronaut position
    const ast = wrap.querySelector('#center-astronaut') as HTMLElement|null;
    if (ast) { ast.style.left = (offX+cx*s)+'px'; ast.style.top = (offY+cy*s)+'px'; }
    container.innerHTML = '';
    stageDeals.current = {};
    ORBIT_KEYS.forEach(k => { stageDeals.current[k] = []; });
    deals.forEach(d => { if (stageDeals.current[d.status]) stageDeals.current[d.status].push(d); });
    ORBIT_KEYS.forEach(stage => {
      if (filter !== 'all' && filter !== stage) return;
      const list = stageDeals.current[stage] || [];
      const orbit = ORBITS[stage];
      const col = GEMCOLS[stage];
      list.forEach((deal, idx) => {
        const count = Math.max(list.length,1);
        const angle = (idx/count)*2*Math.PI - Math.PI/2;
        const px = offX+(cx+orbit.rx*Math.cos(angle))*s;
        const py = offY+(cy+orbit.ry*Math.sin(angle))*s;
        const node = document.createElement('div');
        node.className = 'deal-node';
        node.style.cssText = `position:absolute;transform:translate(-50%,-50%);cursor:pointer;z-index:10;transition:transform .15s;left:${px}px;top:${py}px`;
        node.dataset.rx = String(orbit.rx);
        node.dataset.ry = String(orbit.ry);
        node.dataset.idx = String(idx);
        node.dataset.count = String(count);
        node.innerHTML = `<div style="width:40px;height:40px">${gemSVG(col,stage,idx)}</div><div style="position:absolute;bottom:48px;left:50%;transform:translateX(-50%);background:#111119;border:1px solid rgba(232,48,58,0.2);border-radius:10px;padding:9px 12px;width:160px;z-index:30;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 8px 30px rgba(0,0,0,.6)" class="gem-popup"><div style="font-size:11.5px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${deal.name}</div><div style="font-size:10px;color:rgba(242,240,250,0.3);margin-bottom:4px">${deal.company}</div><div style="font-family:monospace;font-size:15px;font-weight:700;color:#2DD4BF">${fmt(deal.value)}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(242,240,250,0.6);margin-top:1px">${stage}</div></div>`;
        node.addEventListener('mouseenter', () => { const p=node.querySelector('.gem-popup') as HTMLElement|null; if(p) p.style.opacity='1'; node.style.transform='translate(-50%,-50%) scale(1.18)'; node.style.zIndex='20'; });
        node.addEventListener('mouseleave', () => { const p=node.querySelector('.gem-popup') as HTMLElement|null; if(p) p.style.opacity='0'; node.style.transform='translate(-50%,-50%)'; node.style.zIndex='10'; });
        container.appendChild(node);
      });
    });
  }, [deals, filter]);

  // Orbit dot animation
  useEffect(() => {
    const dots = [{id:'od1',rx:70,ry:40,speed:.5,offset:0},{id:'od2',rx:132,ry:74,speed:.32,offset:2.1},{id:'od3',rx:194,ry:108,speed:.22,offset:3.5},{id:'od4',rx:256,ry:142,speed:.16,offset:5.2},{id:'od5',rx:70,ry:40,speed:.5,offset:Math.PI},{id:'od6',rx:132,ry:74,speed:.32,offset:Math.PI+1.4}];
    const cx=400,cy=250;
    function animate() {
      tRef.current += 0.009;
      const t = tRef.current;
      const wrap = wrapRef.current;
      if (!wrap) { animRef.current = requestAnimationFrame(animate); return; }
      const svg = wrap.querySelector('#orbit-svg') as SVGSVGElement|null;
      if (svg) {
        dots.forEach(d => {
          const el = svg.querySelector('#'+d.id);
          if (!el) return;
          const a = t*d.speed+d.offset;
          el.setAttribute('cx',(cx+d.rx*Math.cos(a)).toFixed(1));
          el.setAttribute('cy',(cy+d.ry*Math.sin(a)).toFixed(1));
        });
      }
      animRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Gem orbit animation
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    renderNodes();
    function loop() {
      gemTRef.current += 0.0014;
      const gt = gemTRef.current;
      const W = wrap!.offsetWidth, H = wrap!.offsetHeight;
      const sc = Math.min(W/800,H/480);
      const offX=(W-800*sc)/2, offY=(H-480*sc)/2;
      const cx=400,cy=250;
      const container = nodesRef.current;
      if (container) {
        container.querySelectorAll('.deal-node').forEach(n => {
          const el = n as HTMLElement;
          const rx=+el.dataset.rx!, ry=+el.dataset.ry!, idx=+el.dataset.idx!, count=+el.dataset.count!;
          const speed = 60/(rx+30);
          const a=(idx/count)*2*Math.PI - Math.PI/2 + gt*speed;
          el.style.left=(offX+(cx+rx*Math.cos(a))*sc)+'px';
          el.style.top=(offY+(cy+ry*Math.sin(a))*sc)+'px';
        });
      }
      gemAnimRef.current = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(gemAnimRef.current);
  }, [renderNodes]);

  useEffect(() => {
    window.addEventListener('resize', renderNodes);
    return () => window.removeEventListener('resize', renderNodes);
  }, [renderNodes]);

  async function saveLead() {
    if (!ldName.trim()) { setLdMsg('Enter a business name.'); return; }
    setLdSaving(true); setLdMsg('Saving to Orbit pipeline…');
    try {
      const r = await fetch(FN_URL, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:FN_SECRET,workspace_id:workspaceId,pipeline_id:pipelineId,name:ldName,phone:ldPhone,category:ldCat,value:ldValue,stage:ldStage})});
      const d = await r.json();
      if (d.ok) {
        const newDeal = {name:ldName, company:(ldCat||'lead'), value:ldValue, status:ldStage};
        setDeals(prev => [...prev, newDeal]);
        setTotals(prev => {const n={...prev};n[ldStage]={count:n[ldStage].count+1,value:n[ldStage].value+ldValue};return n;});
        setLdMsg('✓ Launched into '+ldStage+'!');
        setTimeout(()=>{setModal(false);setLdName('');setLdPhone('');setLdCat('');setLdValue(500);setLdMsg('');},900);
      } else { setLdMsg('Error: '+(d.error||'failed')); }
    } catch { setLdMsg('Connection error.'); }
    setLdSaving(false);
  }

  const total = Object.values(totals).reduce((s,x)=>s+x.count,0);
  const totalVal = Object.values(totals).reduce((s,x)=>s+x.value,0);
  const wonVal = totals['Won']?.value||0;
  const draftedCount = totals['SMS Drafted']?.count||0;
  const draftedRate = total>0 ? Math.round((draftedCount/total)*100) : 0;

  // Build side panel data
  const sidePanelData = ORBIT_KEYS.map(stage => {
    const cnt = totals[stage]?.count||0;
    const sv = totals[stage]?.value||0;
    const sampleDeals = deals.filter(d=>d.status===stage).slice(0,6);
    return {stage,cnt,sv,sampleDeals};
  });

  return (
    <div style={{position:'relative',width:'100%',height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'radial-gradient(ellipse 70% 55% at 75% 30%,rgba(100,15,25,0.4) 0%,transparent 65%),radial-gradient(ellipse 40% 35% at 15% 75%,rgba(25,10,55,0.3) 0%,transparent 60%),#060608',fontFamily:"'DM Sans',sans-serif",color:'#F2F0FA'}}>

      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 18px 10px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0,background:'rgba(6,6,8,0.5)'}}>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,whiteSpace:'nowrap'}}>🪐 Orbit Pipeline</div>
        <div style={{fontSize:10,padding:'3px 9px',borderRadius:20,background:'rgba(232,48,58,0.08)',color:'#E8303A',border:'1px solid rgba(232,48,58,0.2)',fontFamily:"'Space Mono',monospace",display:'flex',alignItems:'center',gap:4}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'#E8303A',display:'inline-block',animation:'blink 1.5s infinite'}} />
          LIVE · Pablo Test Co
        </div>
        {[['Deals',String(total),'#F2F0FA'],['Value',fmt(totalVal),'#2DD4BF'],['Won',fmt(wonVal),'#4ADE80']].map(([lbl,val,col])=>(
          <div key={lbl} style={{display:'flex',alignItems:'center',gap:5,background:'#181822',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:'4px 11px',fontSize:11}}>
            <span style={{color:'rgba(242,240,250,0.3)'}}>{lbl}</span>&nbsp;
            <strong style={{color:col}}>{val}</strong>
          </div>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>setModal(true)} style={{height:30,padding:'0 14px',borderRadius:7,border:'1px solid rgba(232,48,58,0.2)',background:'rgba(232,48,58,0.08)',color:'#E8303A',fontSize:11.5,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>+ New Lead</button>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'rgba(242,240,250,0.3)'}}>{clock}</div>
      </div>

      {/* Orbital canvas */}
      <div ref={wrapRef} style={{flex:1,position:'relative',overflow:'hidden'}}>

        {/* SVG ellipses + animated dots */}
        <svg id="orbit-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid meet" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="gr"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="gs"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {filter==='all'||filter==='New Lead'   ? <ellipse cx="400" cy="250" rx="70"  ry="40"  fill="none" stroke="rgba(55,224,197,0.55)"  strokeWidth="1.3" filter="url(#gr)"/> : null}
          {filter==='all'||filter==='SMS Drafted' ? <ellipse cx="400" cy="250" rx="132" ry="74"  fill="none" stroke="rgba(244,185,66,0.5)"   strokeWidth="1.1"/> : null}
          {filter==='all'||filter==='Contacted'   ? <ellipse cx="400" cy="250" rx="194" ry="108" fill="none" stroke="rgba(167,139,250,0.3)"  strokeWidth="1"/> : null}
          {filter==='all'||filter==='Replied'     ? <ellipse cx="400" cy="250" rx="256" ry="142" fill="none" stroke="rgba(95,208,255,0.24)"  strokeWidth="1"/> : null}
          {filter==='all'||filter==='Won'         ? <ellipse cx="400" cy="250" rx="318" ry="176" fill="none" stroke="rgba(54,211,153,0.2)"   strokeWidth="1"/> : null}
          <text x="471" y="254" textAnchor="start" fill="rgba(55,224,197,0.85)"  fontFamily="Rajdhani,sans-serif" fontSize="9"   letterSpacing="2.5" fontWeight="700">NEW LEAD</text>
          <text x="533" y="254" textAnchor="start" fill="rgba(244,185,66,0.78)"  fontFamily="Rajdhani,sans-serif" fontSize="8.5" letterSpacing="2"   fontWeight="700">DRAFTED</text>
          <text x="595" y="254" textAnchor="start" fill="rgba(167,139,250,0.68)" fontFamily="Rajdhani,sans-serif" fontSize="8"   letterSpacing="1.5" fontWeight="600">CONTACTED</text>
          <text x="657" y="254" textAnchor="start" fill="rgba(95,208,255,0.62)"  fontFamily="Rajdhani,sans-serif" fontSize="7.5" letterSpacing="1.5" fontWeight="600">REPLIED</text>
          <text x="719" y="254" textAnchor="start" fill="rgba(54,211,153,0.6)"   fontFamily="Rajdhani,sans-serif" fontSize="7.5" letterSpacing="1.5" fontWeight="600">WON</text>
          <circle id="od1" r="4.5" fill="rgba(55,224,197,0.95)"  filter="url(#gr)"/>
          <circle id="od2" r="3.5" fill="rgba(244,185,66,0.9)"   filter="url(#gs)"/>
          <circle id="od3" r="3"   fill="rgba(167,139,250,0.85)" filter="url(#gs)"/>
          <circle id="od4" r="2.5" fill="rgba(95,208,255,0.85)"/>
          <circle id="od5" r="2.5" fill="rgba(55,224,197,0.6)"/>
          <circle id="od6" r="2"   fill="rgba(244,185,66,0.5)"/>
        </svg>

        {/* Center astronaut */}
        <div id="center-astronaut" style={{position:'absolute',transform:'translate(-50%,-50%)',width:120,height:120,borderRadius:'50%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'radial-gradient(circle at 38% 32%,#2a0810,#0e0410)',border:'1px solid rgba(232,48,58,0.35)',boxShadow:'0 0 50px rgba(232,48,58,0.2),0 0 100px rgba(232,48,58,0.07)',zIndex:5,pointerEvents:'none'}}>
          <svg viewBox="0 0 80 80" width="66" height="66" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="53" rx="15.5" ry="12.5" fill="#1a0508" stroke="rgba(232,48,58,0.4)" strokeWidth="1.2"/>
            <ellipse cx="23.5" cy="48" rx="5" ry="9" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth="1" transform="rotate(-20,23.5,48)"/>
            <ellipse cx="56.5" cy="48" rx="5" ry="9" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth="1" transform="rotate(20,56.5,48)"/>
            <ellipse cx="17.5" cy="56" rx="4.5" ry="3.5" fill="#120408" stroke="rgba(232,48,58,0.4)" strokeWidth=".8"/>
            <ellipse cx="62.5" cy="56" rx="4.5" ry="3.5" fill="#120408" stroke="rgba(232,48,58,0.4)" strokeWidth=".8"/>
            <rect x="34.5" y="47" width="11" height="9" rx="2" fill="rgba(232,48,58,0.12)" stroke="rgba(232,48,58,0.45)" strokeWidth=".8"/>
            <circle cx="40" cy="51.5" r="2" fill="rgba(232,48,58,0.55)"/>
            <rect x="36" y="48.5" width="2.5" height="1.4" rx=".5" fill="rgba(45,212,191,0.55)"/>
            <rect x="41.5" y="48.5" width="2.5" height="1.4" rx=".5" fill="rgba(244,185,66,0.45)"/>
            <rect x="27" y="43" width="7" height="11" rx="2" fill="#120408" stroke="rgba(232,48,58,0.25)" strokeWidth=".7"/>
            <ellipse cx="40" cy="29.5" rx="13" ry="15" fill="#1a0508" stroke="rgba(232,48,58,0.62)" strokeWidth="1.4"/>
            <ellipse cx="40" cy="28.5" rx="9.5" ry="11" fill="#050108"/>
            <ellipse cx="40" cy="28.5" rx="8" ry="9.5" fill="rgba(232,48,58,0.07)"/>
            <ellipse cx="36" cy="23.5" rx="2.8" ry="3.5" fill="rgba(255,255,255,0.13)" transform="rotate(-12,36,23.5)"/>
            <circle cx="44" cy="25.5" r=".7" fill="rgba(255,255,255,0.22)"/>
            <ellipse cx="40" cy="15" rx="4.5" ry="1.7" fill="none" stroke="rgba(232,48,58,0.4)" strokeWidth="1"/>
            <line x1="40" y1="14.5" x2="44.5" y2="8" stroke="rgba(232,48,58,0.5)" strokeWidth="1.2"/>
            <circle cx="45" cy="7.5" r="2" fill="#E8303A"/>
            <circle cx="45" cy="7.5" r="3.5" fill="rgba(232,48,58,0.3)"/>
            <rect x="32" y="63" width="7" height="11" rx="3" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth=".8"/>
            <rect x="41" y="63" width="7" height="11" rx="3" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth=".8"/>
            <ellipse cx="35.5" cy="75.5" rx="5.5" ry="3" fill="#120408" stroke="rgba(232,48,58,0.35)" strokeWidth=".8"/>
            <ellipse cx="44.5" cy="75.5" rx="5.5" ry="3" fill="#120408" stroke="rgba(232,48,58,0.35)" strokeWidth=".8"/>
          </svg>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:700,letterSpacing:3,color:'#E8303A',marginTop:3}}>ORBIT</div>
          <div style={{fontSize:7,letterSpacing:3,color:'rgba(242,240,250,0.3)',marginTop:1}}>PIPELINE</div>
        </div>

        {/* AI Insights panel */}
        <div style={{position:'absolute',left:13,top:13,width:178,background:'rgba(8,8,14,0.93)',border:'1px solid rgba(232,48,58,0.2)',borderRadius:12,padding:12,zIndex:15,backdropFilter:'blur(12px)'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <div style={{width:20,height:20,borderRadius:5,background:'rgba(232,48,58,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>🧠</div>
            <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',letterSpacing:2,color:'#E8303A'}}>AI Insights</div>
          </div>
          <div style={{fontSize:10.5,color:'rgba(242,240,250,0.6)',lineHeight:1.65}}>
            <span style={{color:'#F2F0FA',fontWeight:600}}>{draftedCount} leads drafted</span> &amp; waiting. Fire the SMS batch to push them to Contacted.
          </div>
          <div style={{marginTop:9,paddingTop:9,borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:8}}>
            <div style={{textAlign:'center',flex:1}}>
              <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,color:'#2DD4BF'}}>{draftedRate}%</div>
              <div style={{fontSize:8.5,color:'rgba(242,240,250,0.3)',textTransform:'uppercase',letterSpacing:.5}}>Drafted</div>
            </div>
            <div style={{textAlign:'center',flex:1}}>
              <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:17,fontWeight:700,color:'#E8303A'}}>{draftedCount}</div>
              <div style={{fontSize:8.5,color:'rgba(242,240,250,0.3)',textTransform:'uppercase',letterSpacing:.5}}>Ready to Fire</div>
            </div>
          </div>
        </div>

        {/* Velocity panel */}
        <div style={{position:'absolute',right:224,top:13,width:155,background:'rgba(8,8,14,0.93)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:12,zIndex:15,backdropFilter:'blur(12px)'}}>
          <div style={{fontSize:9.5,fontWeight:600,letterSpacing:1.5,textTransform:'uppercase',color:'rgba(242,240,250,0.3)',marginBottom:4}}>Deal Velocity</div>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:24,fontWeight:700,color:'#2DD4BF'}}>{fmt(totalVal)}</div>
          <div style={{fontSize:9.5,color:'rgba(242,240,250,0.3)',marginTop:1}}>Total pipeline</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:26,marginTop:8}}>
            {[.3,.45,.5,.65,.6,.82,1.0].map((v,i)=>(
              <div key={i} style={{flex:1,borderRadius:'2px 2px 0 0',background:i===6?'#2DD4BF':'rgba(45,212,191,0.2)',minHeight:3,height:(v*100)+'%'}}/>
            ))}
          </div>
        </div>

        {/* Gem nodes container */}
        <div ref={nodesRef} style={{position:'absolute',inset:0}}/>

        {/* Filter pills */}
        <div style={{position:'absolute',bottom:12,left:16,display:'flex',gap:5,zIndex:15,flexWrap:'wrap',maxWidth:'calc(100% - 240px)'}}>
          {[['all','All','rgba(255,255,255,0.07)','rgba(242,240,250,0.3)'],['New Lead','New Lead','rgba(55,224,197,0.3)','rgba(55,224,197,0.75)'],['SMS Drafted','SMS Drafted','rgba(244,185,66,0.3)','rgba(244,185,66,0.75)'],['Contacted','Contacted','rgba(167,139,250,0.3)','rgba(167,139,250,0.75)'],['Replied','Replied','rgba(95,208,255,0.3)','rgba(95,208,255,0.75)'],['Won','Won','rgba(54,211,153,0.3)','rgba(54,211,153,0.75)']].map(([val,lbl,bc,tc])=>(
            <div key={val} onClick={()=>setFilter(val)} style={{padding:'4px 11px',borderRadius:20,fontSize:9.5,fontWeight:600,textTransform:'uppercase',letterSpacing:1,cursor:'pointer',border:filter===val?'1px solid #E8303A':'1px solid '+bc,color:filter===val?'#E8303A':tc,background:filter===val?'rgba(232,48,58,0.08)':'rgba(8,8,14,0.82)',backdropFilter:'blur(8px)',transition:'all .18s'}}>{lbl}</div>
          ))}
        </div>

        {/* Side deal board */}
        <div style={{position:'absolute',right:0,top:0,bottom:0,width:210,background:'rgba(8,8,14,0.92)',borderLeft:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(12px)',overflowY:'auto',zIndex:15,padding:13}}>
          <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'rgba(242,240,250,0.3)',marginBottom:12}}>Deal Board</div>
          {sidePanelData.map(({stage,cnt,sv,sampleDeals})=>(
            <div key={stage} style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,paddingBottom:5,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:STAGE_COLORS[stage]}}>{stage}</div>
                <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,padding:'1px 6px',borderRadius:8,background:'#1F1F2C',color:STAGE_COLORS[stage]}}>{cnt}</div>
              </div>
              {sampleDeals.map((d,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:STAGE_COLORS[stage],flexShrink:0}}/>
                  <div style={{fontSize:10.5,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                  <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:'#2DD4BF'}}>{fmt(d.value)}</div>
                </div>
              ))}
              {cnt>sampleDeals.length&&<div style={{fontSize:9.5,color:'rgba(242,240,250,0.3)',paddingTop:4}}>+ {cnt-sampleDeals.length} more orbiting</div>}
              <div style={{fontSize:10,color:'rgba(242,240,250,0.3)',textAlign:'right',paddingTop:3,fontFamily:"'Rajdhani',sans-serif"}}>{fmt(sv)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Lead Modal */}
      {modal&&(
        <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(4,4,10,0.72)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:340,background:'#111119',border:'1px solid rgba(232,48,58,0.2)',borderRadius:16,padding:22,boxShadow:'0 30px 80px rgba(0,0,0,.6)'}}>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:18,marginBottom:3}}>🪐 New Lead</div>
            <div style={{fontSize:11,color:'rgba(242,240,250,0.3)',marginBottom:16}}>Drops onto the orbit &amp; saves to your Orbit pipeline.</div>
            {[['Business name *',ldName,setLdName,'text'],['Phone',ldPhone,setLdPhone,'text'],['Category (e.g. restaurant)',ldCat,setLdCat,'text']].map(([ph,val,set])=>(
              <input key={ph as string} placeholder={ph as string} value={val as string} onChange={e=>(set as (v:string)=>void)(e.target.value)} style={{width:'100%',background:'#181822',border:'1px solid rgba(255,255,255,0.07)',borderRadius:9,padding:'10px 12px',fontSize:13,color:'#F2F0FA',outline:'none',marginBottom:9,fontFamily:"'DM Sans',sans-serif"}} />
            ))}
            <div style={{display:'flex',gap:9,marginBottom:9}}>
              <input type="number" value={ldValue} onChange={e=>setLdValue(Number(e.target.value))} style={{flex:1,background:'#181822',border:'1px solid rgba(255,255,255,0.07)',borderRadius:9,padding:'10px 12px',fontSize:13,color:'#F2F0FA',outline:'none',fontFamily:"'DM Sans',sans-serif"}} />
              <select value={ldStage} onChange={e=>setLdStage(e.target.value)} style={{flex:1.3,background:'#181822',border:'1px solid rgba(255,255,255,0.07)',borderRadius:9,padding:'10px 12px',fontSize:13,color:'#F2F0FA',outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
                {ORBIT_KEYS.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={{fontSize:11,minHeight:16,marginBottom:8,color:ldMsg.startsWith('✓')?'#2DD4BF':ldMsg.startsWith('Error')||ldMsg.startsWith('Connection')?'#E8303A':'rgba(242,240,250,0.3)'}}>{ldMsg}</div>
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setModal(false)} style={{flex:1,padding:11,borderRadius:9,border:'1px solid rgba(255,255,255,0.07)',background:'transparent',color:'rgba(242,240,250,0.6)',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={saveLead} disabled={ldSaving} style={{flex:1.4,padding:11,borderRadius:9,border:'none',background:'#E8303A',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",letterSpacing:.5}}>{ldSaving?'Launching…':'Launch Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
