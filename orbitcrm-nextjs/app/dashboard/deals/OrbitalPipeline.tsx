'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// Compact ring sizes — half the original for a tighter, more clickable orbit
const RING_SIZES = [
  {rx:48, ry:28},
  {rx:88, ry:50},
  {rx:128, ry:72},
  {rx:168, ry:94},
  {rx:208, ry:116},
  ];
const RING_COLORS = ['#37e0c5','#F4B942','#A78BFA','#5fd0ff','#36d399'];

const FN_URL = 'https://jlbnieorltkfezixulxc.supabase.co/functions/v1/add-lead';
const FN_SECRET = 'whk_orbit_9f3c1a7e8b2d4056aa1199ccee';

type Stage = {id:string;name:string;color:string|null;is_won:boolean;is_lost:boolean;sort_order:number};
type Deal = {id?:string;name:string;company:string;value:number;status:string;stage_id?:string};

function gemSVG(fill:string, uid:string) {
    return `<svg viewBox="0 0 32 32" width="32" height="32"><defs><filter id="gf${uid}"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><polygon points="16,2 29,11 24,29 8,29 3,11" fill="${fill}" opacity=".14" stroke="${fill}" stroke-width="1" filter="url(#gf${uid})"/><polygon points="16,5 27,13 22,27 10,27 5,13" fill="${fill}" opacity=".32"/><polygon points="16,9 24,15 20,25 12,25 8,15" fill="${fill}" opacity=".75"/><polygon points="16,13 22,18 19,24 13,24 10,18" fill="rgba(255,255,255,0.3)"/></svg>`;
}

interface Props {
    initialDeals: Deal[];
    stages: Stage[];
    workspaceId: string;
    pipelineId: string | null;
}

export default function OrbitalPipeline({ initialDeals, stages, workspaceId, pipelineId }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const nodesRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<number>(0);
    const tRef = useRef(0);
    const [deals, setDeals] = useState<Deal[]>(initialDeals);
    const [filter, setFilter] = useState('all');
    const [clock, setClock] = useState('--:--:--');
    const [modal, setModal] = useState(false);
    const [ldName, setLdName] = useState('');
    const [ldPhone, setLdPhone] = useState('');
    const [ldCat, setLdCat] = useState('');
    const [ldValue, setLdValue] = useState(500);
    const [ldStage, setLdStage] = useState('');
    const [ldMsg, setLdMsg] = useState('');
    const [ldSaving, setLdSaving] = useState(false);
    const [selected, setSelected] = useState<Deal|null>(null);

  const sortedStages = [...stages].sort((a,b) => a.sort_order - b.sort_order).slice(0, 5);
    const stageToRingIdx: Record<string,number> = {};
    sortedStages.forEach((s, i) => { stageToRingIdx[s.name] = i; });

  useEffect(() => {
        if(sortedStages.length > 0 && !ldStage) setLdStage(sortedStages[0].name);
  }, [sortedStages.length]);

  useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-US',{hour12:false})),1000);
        setClock(new Date().toLocaleTimeString('en-US',{hour12:false}));
        return () => clearInterval(t);
  }, []);

  const byStage: Record<string,Deal[]> = {};
    sortedStages.forEach(s => { byStage[s.name] = []; });
    deals.forEach(d => {
          if(byStage[d.status] !== undefined) byStage[d.status].push(d);
    });

  const totals: Record<string,{count:number;value:number}> = {};
    sortedStages.forEach(s => {
          const arr = byStage[s.name] || [];
          totals[s.name] = { count: arr.length, value: arr.reduce((sum,d)=>sum+d.value,0) };
    });

  const totalDeals = deals.length;
    const totalVal = Object.values(totals).reduce((s,x)=>s+x.value, 0);
    const wonStage = sortedStages.find(s => s.is_won);
    const wonVal = wonStage ? (totals[wonStage.name]?.value || 0) : 0;
    const fmt = (v:number) => v>=1000?'$'+(v/1000).toFixed(1)+'K':'$'+v.toFixed(0);

  const renderNodes = useCallback(() => {
        const wrap = wrapRef.current;
        const container = nodesRef.current;
        if(!wrap||!container) return;
        // Use a smaller virtual canvas (500x320) so rings stay compact
                                      const W=wrap.offsetWidth, H=wrap.offsetHeight;
        const s=Math.min(W/500,H/320,1.4);
        const offX=(W-500*s)/2, offY=(H-320*s)/2;
        const cx=250, cy=160;
        container.innerHTML='';
        sortedStages.forEach((stage, ringIdx) => {
                if(filter !== 'all' && filter !== stage.name) return;
                const list = byStage[stage.name] || [];
                const orbit = RING_SIZES[ringIdx];
                const col = stage.color || RING_COLORS[ringIdx];
                list.forEach((deal, idx) => {
                          const count = Math.max(list.length, 1);
                          const angle = (idx/count)*2*Math.PI - Math.PI/2;
                          const px = offX+(cx+orbit.rx*Math.cos(angle))*s;
                          const py = offY+(cy+orbit.ry*Math.sin(angle))*s;
                          const node = document.createElement('div');
                          node.style.cssText=`position:absolute;transform:translate(-50%,-50%);cursor:pointer;z-index:10;transition:transform .15s;left:${px}px;top:${py}px`;
                          node.innerHTML=`<div style="width:32px;height:32px;position:relative">${gemSVG(col,(stage.name+idx).replace(/[^a-z0-9]/gi,''))}<div style="position:absolute;bottom:38px;left:50%;transform:translateX(-50%);background:#111119;border:1px solid rgba(232,48,58,0.2);border-radius:10px;padding:7px 10px;width:148px;z-index:30;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 8px 30px rgba(0,0,0,.6)" class="gem-popup"><div style="font-size:11px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${deal.name}</div><div style="font-size:9.5px;color:rgba(242,240,250,0.3);margin-bottom:3px">${deal.company||''}</div><div style="font-family:monospace;font-size:14px;font-weight:700;color:#2DD4BF">${fmt(deal.value)}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(242,240,250,0.6);margin-top:1px">${stage.name}</div></div></div>`;
                          node.addEventListener('mouseenter',()=>{const p=node.querySelector('.gem-popup') as HTMLElement;if(p)p.style.opacity='1';node.style.transform='translate(-50%,-50%) scale(1.22)';node.style.zIndex='20';});
                          node.addEventListener('mouseleave',()=>{const p=node.querySelector('.gem-popup') as HTMLElement;if(p)p.style.opacity='0';node.style.transform='translate(-50%,-50%)';node.style.zIndex='10';});
                          node.addEventListener('click',()=>setSelected(deal));
                          container.appendChild(node);
                });
        });
  }, [deals, filter, sortedStages]);

  // Animate the SVG orbit dots
  useEffect(() => {
        const wrap = wrapRef.current;
        if(!wrap) return;
        renderNodes();
        (function loop(){
                tRef.current += 0.004;
                const t = tRef.current;
                const W=wrap.offsetWidth, H=wrap.offsetHeight;
                const s=Math.min(W/500,H/320,1.4);
                const offX=(W-500*s)/2, offY=(H-320*s)/2;
                const cx=250, cy=160;
                const svg=document.getElementById('orbit-dots-svg');
                if(svg){
                          [{id:'od1',rx:48,ry:28,speed:.5,offset:0},{id:'od2',rx:88,ry:50,speed:.32,offset:2.1},{id:'od3',rx:128,ry:72,speed:.22,offset:4.1},{id:'od4',rx:168,ry:94,speed:.16,offset:1.2},{id:'od5',rx:208,ry:116,speed:.12,offset:3.3}].forEach(d=>{
                                      const el=svg.querySelector('#'+d.id);if(!el)return;
                                      const a=t*d.speed+d.offset;
                                      el.setAttribute('cx',((offX+(cx+d.rx*Math.cos(a))*s)).toFixed(1));
                                      el.setAttribute('cy',((offY+(cy+d.ry*Math.sin(a))*s)).toFixed(1));
                          });
                }
                animRef.current=requestAnimationFrame(loop);
        })();
        return () => cancelAnimationFrame(animRef.current);
  }, [renderNodes]);

  useEffect(() => {
        window.addEventListener('resize', renderNodes);
        return () => window.removeEventListener('resize', renderNodes);
  }, [renderNodes]);

  async function saveLead() {
        if(!ldName.trim()){setLdMsg('Enter a business name.');return;}
        setLdSaving(true); setLdMsg('Saving...');
        try {
                const r=await fetch(FN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:FN_SECRET,workspace_id:workspaceId,pipeline_id:pipelineId,name:ldName,phone:ldPhone,category:ldCat,value:ldValue,stage:ldStage})});
                const d=await r.json();
                if(d.ok){
                          setDeals(prev=>[...prev,{name:ldName,company:ldCat||'',value:ldValue,status:ldStage}]);
                          setLdMsg('Launched into '+ldStage+'!');
                          setTimeout(()=>{setModal(false);setLdName('');setLdPhone('');setLdCat('');setLdValue(500);setLdMsg('');},900);
                } else { setLdMsg('Error: '+(d.error||'failed')); }
        } catch(e){ setLdMsg('Network error'); }
        setLdSaving(false);
  }

  // Compact SVG canvas 500x320
  const W_SVG=500, H_SVG=320, cx=250, cy=160;

  return (
        <div style={{position:'relative',width:'100%',height:'100%',minHeight:400,background:'radial-gradient(ellipse at 50% 60%,rgba(30,10,40,.95) 0%,#05050f 100%)',borderRadius:16,overflow:'hidden',fontFamily:"'Rajdhani',sans-serif"}}>

          {/* Top bar */}
                <div style={{position:'absolute',top:0,left:0,right:0,zIndex:20,display:'flex',alignItems:'center',padding:'10px 14px',background:'rgba(5,5,15,0.7)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'rgba(242,240,250,0.5)'}}>ORBIT PIPELINE</div>div>
                          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
                                      <div style={{fontSize:11,fontFamily:'monospace',color:'rgba(242,240,250,0.35)',letterSpacing:1}}>{clock}</div>div>
                                      <div style={{fontSize:11,color:'rgba(242,240,250,0.4)'}}>|</div>div>
                                      <div style={{fontSize:11,color:'#2DD4BF',fontWeight:700}}>{totalDeals} deals</div>div>
                                      <div style={{fontSize:11,color:'rgba(242,240,250,0.4)'}}>|</div>div>
                                      <div style={{fontSize:11,color:'#F4B942',fontWeight:700}}>{fmt(totalVal)}</div>div>
                            {wonVal>0&&<><div style={{fontSize:11,color:'rgba(242,240,250,0.4)'}}>|</div>div><div style={{fontSize:11,color:'#36d399',fontWeight:700}}>Won {fmt(wonVal)}</div>div></>>}
                          </div>div>
                </div>div>
        
          {/* Stage filter pills */}
              <div style={{position:'absolute',top:38,left:0,right:0,zIndex:20,display:'flex',gap:5,padding:'6px 14px',overflowX:'auto'}}>
                      <button onClick={()=>setFilter('all')} style={{padding:'3px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.12)',background:filter==='all'?'rgba(255,255,255,0.12)':'transparent',color:'rgba(242,240,250,0.7)',fontSize:10,cursor:'pointer',letterSpacing:.5,whiteSpace:'nowrap'}}>All</button>button>
                {sortedStages.map((s,i)=>{
                    const col=s.color||RING_COLORS[i];
                    return(
                                  <button key={s.id} onClick={()=>setFilter(filter===s.name?'all':s.name)} style={{padding:'3px 10px',borderRadius:20,border:`1px solid ${col}55`,background:filter===s.name?col+'33':'transparent',color:filter===s.name?col:'rgba(242,240,250,0.6)',fontSize:10,cursor:'pointer',letterSpacing:.5,whiteSpace:'nowrap'}}>
                                    {s.name}
                                  </button>button>
                                );
        })}
                      <button onClick={()=>setModal(true)} style={{marginLeft:'auto',padding:'3px 12px',borderRadius:20,border:'1px solid #E8303A88',background:'rgba(232,48,58,0.15)',color:'#E8303A',fontSize:10,cursor:'pointer',letterSpacing:.5,whiteSpace:'nowrap',flexShrink:0}}>+ Add Lead</button>button>
              </div>div>
        
          {/* Main orbit canvas */}
              <div ref={wrapRef} style={{position:'absolute',top:70,left:0,right:210,bottom:0}}>
                {/* SVG ellipses */}
                      <svg id="orbit-dots-svg" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
                                <defs>
                                  {sortedStages.map((s,i)=>{
                        const col=s.color||RING_COLORS[i];
                        return <radialGradient key={s.id} id={`rg${i}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={col} stopOpacity=".18"/><stop offset="100%" stopColor={col} stopOpacity="0"/></radialGradient>radialGradient>;
        })}
                                </defs>defs>
                        {/* Orbit ellipses — recomputed via JS percentages using the virtual 500x320 canvas */}
                        {sortedStages.map((s,i)=>{
                      const col=s.color||RING_COLORS[i];
                      const orbit=RING_SIZES[i];
                      if(filter!=='all'&&filter!==s.name) return null;
                      return(
                                      <ellipse key={s.id}
                                                        cx="50%" cy="50%"
                                                        rx={`${(orbit.rx/500*100)}%`}
                                                        ry={`${(orbit.ry/320*100)}%`}
                                                        fill="none"
                                                        stroke={col}
                                                        strokeWidth="1"
                                                        strokeOpacity=".2"
                                                        strokeDasharray="3 6"
                                                      />
                                    );
        })}
                        {/* Animated dots */}
                        {sortedStages.map((s,i)=>{
                      if(filter!=='all'&&filter!==s.name) return null;
                      const col=s.color||RING_COLORS[i];
                      return <circle key={s.id} id={`od${i+1}`} r="4" fill={col} opacity=".75" cx="50%" cy="50%"/>;
        })}
                      </svg>svg>
                {/* Gem nodes */}
                      <div ref={nodesRef} style={{position:'absolute',inset:0}} />
                {/* Center hub */}
                      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:44,height:44,borderRadius:'50%',background:'radial-gradient(circle,rgba(232,48,58,0.3),rgba(232,48,58,0.05))',border:'1.5px solid rgba(232,48,58,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,zIndex:5,boxShadow:'0 0 18px rgba(232,48,58,0.3)'}}>🌐</div>div>
              </div>div>
        
          {/* Side panel */}
              <div style={{position:'absolute',right:0,top:70,bottom:0,width:210,background:'rgba(8,8,20,0.92)',borderLeft:'1px solid rgba(255,255,255,0.05)',padding:'10px 10px',overflowY:'auto'}}>
                      <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'rgba(242,240,250,0.35)',marginBottom:8}}>Stages</div>div>
                {sortedStages.map((stage,i)=>{
                    const col = stage.color || RING_COLORS[i];
                    const cnt = totals[stage.name]?.count || 0;
                    const val = totals[stage.name]?.value || 0;
                    const sample = (byStage[stage.name]||[]).slice(0,4);
                    return (
                                  <div key={stage.id} style={{marginBottom:10}}>
                                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4,padding:'2px 0'}}>
                                                                <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:col}}>{stage.name}</span>span>
                                                                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:9,padding:'1px 5px',borderRadius:8,background:col+'22',color:col}}>{cnt}</span>span>
                                                </div>div>
                                    {sample.map((d,idx)=>(
                                                    <div key={idx} onClick={()=>setSelected(d)} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer'}}>
                                                                      <span style={{width:5,height:5,borderRadius:'50%',background:col,flexShrink:0,display:'inline-block'}}/>
                                                                      <span style={{fontSize:10,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</span>span>
                                                                      <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:'#2DD4BF'}}>{fmt(d.value)}</span>span>
                                                    </div>div>
                                                  ))}
                                    {cnt>sample.length&&<div style={{fontSize:9.5,color:'rgba(242,240,250,0.3)',paddingTop:3}}>+{cnt-sample.length} more</div>div>}
                                                <div style={{fontSize:10,color:'rgba(242,240,250,0.3)',textAlign:'right',paddingTop:2,fontFamily:"'Rajdhani',sans-serif"}}>{fmt(val)}</div>div>
                                  </div>div>
                                );
        })}
              </div>div>
        
          {/* Deal detail modal */}
          {selected&&(
                  <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <div onClick={e=>e.stopPropagation()} style={{background:'#0e0e1e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'22px 24px',minWidth:240,maxWidth:320,boxShadow:'0 8px 40px rgba(0,0,0,.8)'}}>
                                        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>{selected.name}</div>div>
                                        <div style={{fontSize:12,color:'rgba(242,240,250,0.45)',marginBottom:4}}>{selected.company||'—'}</div>div>
                                        <div style={{fontSize:20,fontWeight:700,color:'#2DD4BF',fontFamily:"'Rajdhani',sans-serif",marginBottom:4}}>{fmt(selected.value)}</div>div>
                                        <div style={{fontSize:11,color:'rgba(242,240,250,0.5)',textTransform:'uppercase',letterSpacing:1}}>{selected.status}</div>div>
                                        <button onClick={()=>setSelected(null)} style={{marginTop:14,padding:'6px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'rgba(242,240,250,0.7)',cursor:'pointer',fontSize:12}}>Close</button>button>
                            </div>div>
                  </div>div>
              )}
        
          {/* Add lead modal */}
          {modal&&(
                  <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <div onClick={e=>e.stopPropagation()} style={{background:'#0e0e1e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'22px 24px',width:300,boxShadow:'0 8px 40px rgba(0,0,0,.8)'}}>
                                        <div style={{fontSize:14,fontWeight:700,marginBottom:14,letterSpacing:1}}>Launch New Lead</div>div>
                              {(['Business Name*','Phone','Category / Industry'].map((label,i)=>{
                                  const keys=['ldName','ldPhone','ldCat'];
                                  const vals=[ldName,ldPhone,ldCat];
                                  const setters=[setLdName,setLdPhone,setLdCat];
                                  return(
                                                    <div key={i} style={{marginBottom:10}}>
                                                                      <div style={{fontSize:10,color:'rgba(242,240,250,0.4)',marginBottom:3}}>{label}</div>div>
                                                                      <input value={vals[i]} onChange={e=>setters[i](e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#f2f0fa',fontSize:12,boxSizing:'border-box'}} />
                                                    </div>div>
                                                  );
                  }))}
                                        <div style={{marginBottom:10}}>
                                                      <div style={{fontSize:10,color:'rgba(242,240,250,0.4)',marginBottom:3}}>Value ($)</div>div>
                                                      <input type="number" value={ldValue} onChange={e=>setLdValue(Number(e.target.value))} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#f2f0fa',fontSize:12,boxSizing:'border-box'}}/>
                                        </div>div>
                                        <div style={{marginBottom:14}}>
                                                      <div style={{fontSize:10,color:'rgba(242,240,250,0.4)',marginBottom:3}}>Stage</div>div>
                                                      <select value={ldStage} onChange={e=>setLdStage(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'#0e0e1e',color:'#f2f0fa',fontSize:12,boxSizing:'border-box'}}>
                                                        {sortedStages.map(s=><option key={s.id} value={s.name}>{s.name}</option>option>)}
                                                      </select>select>
                                        </div>div>
                              {ldMsg&&<div style={{fontSize:11,color:ldMsg.startsWith('Error')?'#E8303A':'#36d399',marginBottom:8}}>{ldMsg}</div>div>}
                                        <div style={{display:'flex',gap:8}}>
                                                      <button onClick={()=>setModal(false)} style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(242,240,250,0.5)',cursor:'pointer',fontSize:12}}>Cancel</button>button>
                                                      <button onClick={saveLead} disabled={ldSaving} style={{flex:2,padding:'8px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#E8303A,#a0001a)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700}}>
                                                        {ldSaving?'Launching…':'Launch'}
                                                      </button>button>
                                        </div>div>
                            </div>div>
                  </div>div>
              )}
        </div>div>
      );
}</>
