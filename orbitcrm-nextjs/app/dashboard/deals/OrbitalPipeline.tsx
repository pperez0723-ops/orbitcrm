'use client';
import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { createClient } from '@/lib/supabase-browser';

const RING_SIZES = [{rx:70,ry:40},{rx:132,ry:74},{rx:194,ry:108},{rx:256,ry:142},{rx:318,ry:176},{rx:370,ry:200},{rx:420,ry:224},{rx:460,ry:244}];
const GEM_PALETTE = ['#37e0c5','#F4B942','#A78BFA','#5fd0ff','#36d399','#f87171','#fb923c','#a3e635'];
const DOT_ORBITS = [{rx:70,ry:40,speed:.5,offset:0},{rx:132,ry:74,speed:.32,offset:2.1},{rx:194,ry:108,speed:.22,offset:3.5},{rx:256,ry:142,speed:.16,offset:5.2},{rx:70,ry:40,speed:.5,offset:Math.PI},{rx:132,ry:74,speed:.32,offset:Math.PI+1.4}];

type Deal={id:string;name:string;company:string;phone:string;value:number;status:string;stage_id:string;contact_id:string;contacts?:{fname?:string;lname?:string;company?:string;phone?:string}};
type Totals=Record<string,{count:number;value:number}>;
interface Props{initialDeals:Deal[];stages:{id:string;name:string;color:string|null;is_won:boolean;is_lost:boolean;sort_order:number}[];workspaceId:string;pipelineId:string|null;}

function gemSVG(fill:string,uid:string):string{return `<svg viewBox="0 0 40 40" width="40" height="40"><defs><filter id="gf${uid}"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><polygon points="20,3 36,14 30,36 10,36 4,14" fill="${fill}" opacity=".14" stroke="${fill}" stroke-width="1.2" filter="url(#gf${uid})"/><polygon points="20,7 33,16 27,33 13,33 7,16" fill="${fill}" opacity=".32"/><polygon points="20,11 29,19 25,30 15,30 11,19" fill="${fill}" opacity=".75"/><polygon points="20,16 27,22 24,29 16,29 13,22" fill="rgba(255,255,255,0.3)"/></svg>`;}
function fmt(v:number):string{return v>=1000?'$'+(v/1000).toFixed(1)+'K':'$'+v.toFixed(0);}

export default function OrbitalPipeline({initialDeals,stages,workspaceId,pipelineId}:Props){
const supabase=createClient();
const wrapRef=useRef<HTMLDivElement>(null);
const svgRef=useRef<SVGSVGElement>(null);
const nodesRef=useRef<HTMLDivElement>(null);
const rafRef=useRef<number>(0);
const tRef=useRef(0);
const builtRef=useRef(false);
const dealsRef=useRef<Deal[]>(initialDeals);
const filterRef=useRef('all');

const [deals,setDeals]=useState<Deal[]>(initialDeals);
const [totals,setTotals]=useState<Totals>(()=>{const t:Totals={};stages.forEach(s=>{t[s.name]={count:0,value:0};});initialDeals.forEach(d=>{if(t[d.status]){t[d.status].count++;t[d.status].value+=d.value;}});return t;});
const [filter,setFilter]=useState('all');
const [modal,setModal]=useState(false);
const [selected,setSelected]=useState<Deal|null>(null);
const [ldName,setLdName]=useState('');
const [ldPhone,setLdPhone]=useState('');
const [ldCat,setLdCat]=useState('');
const [ldValue,setLdValue]=useState(500);
const [ldStage,setLdStage]=useState('');
const [ldMsg,setLdMsg]=useState('');
const [ldSaving,setLdSaving]=useState(false);
const [moveSaving,setMoveSaving]=useState(false);
const [moveStageId,setMoveStageId]=useState('');

const orbitKeys=useMemo(()=>stages.map(s=>s.name),[stages]);
const orbits=useMemo(()=>{const o:Record<string,{rx:number;ry:number}>={};stages.forEach((s,i)=>{o[s.name]=RING_SIZES[i]||RING_SIZES[RING_SIZES.length-1];});return o;},[stages]);
const gemCols=useMemo(()=>{const c:Record<string,string>={};stages.forEach((s,i)=>{c[s.name]=s.color||GEM_PALETTE[i%GEM_PALETTE.length];});return c;},[stages]);

// Build gem nodes once - only transform updated in rAF (no DOM thrash)
const buildNodes=useCallback(()=>{
const wrap=wrapRef.current,container=nodesRef.current;
if(!wrap||!container)return;
container.innerHTML='';
const currentDeals=dealsRef.current;
const currentFilter=filterRef.current;
orbitKeys.forEach(stage=>{
if(currentFilter!=='all'&&currentFilter!==stage)return;
const list=currentDeals.filter(d=>d.status===stage);
const orbit=orbits[stage]||RING_SIZES[0];
const col=gemCols[stage]||'#37e0c5';
list.forEach((deal,idx)=>{
const count=Math.max(list.length,1);
const uid=stage.replace(/\s/g,'')+idx;
const node=document.createElement('div');
node.className='deal-node';
node.dataset.rx=String(orbit.rx);
node.dataset.ry=String(orbit.ry);
node.dataset.idx=String(idx);
node.dataset.count=String(count);
node.dataset.dealid=deal.id;
node.dataset.stage=stage;
node.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);cursor:pointer;z-index:10;will-change:transform;';
node.innerHTML=`<div style="width:40px;height:40px">${gemSVG(col,uid)}</div><div class="gem-popup" style="position:absolute;bottom:48px;left:50%;transform:translateX(-50%);background:#111119;border:1px solid ${col}44;border-radius:10px;padding:9px 12px;width:160px;z-index:30;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 8px 30px rgba(0,0,0,.6)"><div style="font-size:11.5px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f2f0fa">${deal.name}</div><div style="font-size:10px;color:rgba(242,240,250,0.5);margin-bottom:4px">${deal.company||''}</div><div style="font-family:monospace;font-size:15px;font-weight:700;color:${col}">${fmt(deal.value)}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(242,240,250,0.5);margin-top:1px">${stage}</div><div style="font-size:9px;color:${col};margin-top:3px;opacity:.7">click to open ▶</div></div>`;
node.addEventListener('mouseenter',()=>{const p=node.querySelector('.gem-popup') as HTMLElement|null;if(p)p.style.opacity='1';node.style.zIndex='20';});
node.addEventListener('mouseleave',()=>{const p=node.querySelector('.gem-popup') as HTMLElement|null;if(p)p.style.opacity='0';node.style.zIndex='10';});
node.addEventListener('click',()=>{const d=dealsRef.current.find(x=>x.id===deal.id)||deal;setSelected(d);setMoveStageId(d.stage_id);});
container.appendChild(node);
});
});
builtRef.current=true;
},[orbitKeys,orbits,gemCols]);

// Single unified rAF: move SVG dots + move gem nodes via transform (GPU only)
useEffect(()=>{
function loop(){
tRef.current+=0.009;
const t=tRef.current;
const wrap=wrapRef.current;
if(!wrap){rafRef.current=requestAnimationFrame(loop);return;}
const W=wrap.offsetWidth,H=wrap.offsetHeight;
const sc=Math.min(W/800,H/480);
const offX=(W-800*sc)/2,offY=(H-480*sc)/2;
const cx=400,cy=250;
// Move SVG orbit dots
const svg=svgRef.current;
if(svg){
DOT_ORBITS.forEach((d,i)=>{
const el=svg.querySelector('#od'+(i+1)) as SVGCircleElement|null;
if(!el)return;
const a=d.offset+t*d.speed;
const x=offX+(cx+d.rx*Math.cos(a))*sc;
const y=offY+(cy+d.ry*Math.sin(a))*sc;
el.setAttribute('cx',String(x));
el.setAttribute('cy',String(y));
});
}
// Move astronaut center
const ast=wrap.querySelector('#center-astronaut') as HTMLElement|null;
if(ast){ast.style.left=(offX+cx*sc)+'px';ast.style.top=(offY+cy*sc)+'px';}
// Move gem nodes - update transform only (no DOM rebuild)
const container=nodesRef.current;
if(container&&builtRef.current){
const nodes=container.querySelectorAll('.deal-node');
nodes.forEach((nd)=>{
const n=nd as HTMLElement;
const rx=parseFloat(n.dataset.rx||'100');
const ry=parseFloat(n.dataset.ry||'60');
const idx=parseFloat(n.dataset.idx||'0');
const count=parseFloat(n.dataset.count||'1');
const baseAngle=(idx/count)*2*Math.PI-Math.PI/2;
const speed=0.0014/(rx/100);
const angle=baseAngle+t*speed;
const px=offX+(cx+rx*Math.cos(angle))*sc;
const py=offY+(cy+ry*Math.sin(angle))*sc;
n.style.transform=`translate(calc(${px}px - 50%), calc(${py}px - 50%))`;
});
}
rafRef.current=requestAnimationFrame(loop);
}
loop();
return()=>cancelAnimationFrame(rafRef.current);
},[]);

// Build nodes on mount and when deals/filter change (NOT in rAF)
useEffect(()=>{
dealsRef.current=deals;
filterRef.current=filter;
buildNodes();
},[deals,filter,buildNodes]);

// Rebuild on resize (debounced)
useEffect(()=>{
let tid=0;
const onResize=()=>{clearTimeout(tid);tid=window.setTimeout(()=>buildNodes(),120);};
window.addEventListener('resize',onResize);
return()=>window.removeEventListener('resize',onResize);
},[buildNodes]);

async function saveMove(){
if(!selected||!moveStageId)return;
setMoveSaving(true);
const newStage=stages.find(s=>s.id===moveStageId);
await supabase.from('deals').update({stage_id:moveStageId}).eq('id',selected.id);
const updated=deals.map(d=>d.id===selected.id?{...d,stage_id:moveStageId,status:newStage?.name||d.status}:d);
setDeals(updated);
const t:Totals={};stages.forEach(s=>{t[s.name]={count:0,value:0};});updated.forEach(d=>{if(t[d.status]){t[d.status].count++;t[d.status].value+=d.value;}});setTotals(t);
setSelected(null);setMoveSaving(false);
}

async function saveLead(){
if(!ldName.trim())return;
setLdSaving(true);
const stg=stages.find(s=>s.name===ldStage)||stages[0];
const{data}=await supabase.from('deals').insert({workspace_id:workspaceId,pipeline_id:pipelineId,title:ldName,stage_id:stg?.id,value:ldValue,notes:ldMsg}).select('*').single();
if(data){const nd:Deal={id:data.id,name:ldName,company:ldCat,phone:ldPhone,value:ldValue,status:stg?.name||'',stage_id:stg?.id||'',contact_id:data.contact_id||''};const nd2=[...deals,nd];setDeals(nd2);const t:Totals={};stages.forEach(s=>{t[s.name]={count:0,value:0};});nd2.forEach(d=>{if(t[d.status]){t[d.status].count++;t[d.status].value+=d.value;}});setTotals(t);}
setModal(false);setLdName('');setLdPhone('');setLdCat('');setLdValue(500);setLdMsg('');setLdSaving(false);
}

const totalDeals=deals.length;
const totalValue=deals.reduce((s,d)=>s+d.value,0);

return(
<div style={{position:'relative',width:'100%',height:'100vh',background:'#060608',overflow:'hidden',fontFamily:'Inter,system-ui,sans-serif'}}>
{/* HUD top bar */}
<div style={{position:'absolute',top:0,left:0,right:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',background:'linear-gradient(180deg,rgba(6,6,8,0.95) 0%,transparent 100%)'}}>
<div style={{display:'flex',alignItems:'center',gap:16}}>
<div style={{width:8,height:8,borderRadius:'50%',background:'#37e0c5',boxShadow:'0 0 12px #37e0c5',animation:'pulse 2s infinite'}}/>
<span style={{fontSize:12,fontFamily:'monospace',color:'rgba(242,240,250,0.5)',letterSpacing:2}}>ORBIT CRM</span>
<span style={{fontSize:11,fontFamily:'monospace',color:'rgba(242,240,250,0.3)'}}>v2.0</span>
</div>
<div style={{display:'flex',gap:24,alignItems:'center'}}>
<span style={{fontSize:11,fontFamily:'monospace',color:'rgba(242,240,250,0.4)'}}>{totalDeals} DEALS</span>
<span style={{fontSize:11,fontFamily:'monospace',color:'#37e0c5'}}>{fmt(totalValue)}</span>
</div>
<button onClick={()=>setModal(true)} style={{background:'transparent',border:'1px solid rgba(55,224,197,0.4)',color:'#37e0c5',borderRadius:8,padding:'6px 16px',fontSize:12,cursor:'pointer',letterSpacing:1,fontFamily:'monospace'}}>+ NEW LEAD</button>
</div>

{/* Stage filter tabs */}
<div style={{position:'absolute',top:52,left:0,right:0,zIndex:40,display:'flex',gap:8,padding:'0 24px',overflowX:'auto'}}>
{['all',...orbitKeys].map(k=>(
<button key={k} onClick={()=>{setFilter(k);filterRef.current=k;buildNodes();}} style={{background:filter===k?'rgba(55,224,197,0.15)':'transparent',border:`1px solid ${filter===k?'rgba(55,224,197,0.6)':'rgba(242,240,250,0.1)'}`,color:filter===k?'#37e0c5':'rgba(242,240,250,0.4)',borderRadius:20,padding:'4px 14px',fontSize:11,cursor:'pointer',fontFamily:'monospace',letterSpacing:1,whiteSpace:'nowrap'}}>
{k==='all'?'ALL':k.toUpperCase()}
{k!=='all'&&totals[k]?<span style={{marginLeft:6,opacity:.7}}>{totals[k].count}</span>:null}
</button>
))}
</div>

{/* Orbit wrapper */}
<div ref={wrapRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
{/* SVG for orbit ellipses + dots */}
<svg ref={svgRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'}} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
<defs>
<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
{RING_SIZES.slice(0,stages.length||1).map((r,i)=>(
<ellipse key={i} cx="400" cy="250" rx={r.rx} ry={r.ry} fill="none" stroke="rgba(55,224,197,0.12)" strokeWidth="1" strokeDasharray="4 8"/>
))}
{DOT_ORBITS.map((_,i)=>(
<circle key={i} id={`od${i+1}`} r="3" fill="#37e0c5" opacity="0.6" filter="url(#glow)" cx="400" cy="250"/>
))}
</svg>

{/* Gem nodes container - absolute positioned divs */}
<div ref={nodesRef} style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:10}}/>

{/* Astronaut center */}
<div id="center-astronaut" style={{position:'absolute',transform:'translate(-50%,-50%)',zIndex:15,pointerEvents:'none'}}>
<svg width="72" height="72" viewBox="0 0 72 72" fill="none">
<circle cx="36" cy="36" r="28" fill="rgba(55,224,197,0.08)" stroke="rgba(55,224,197,0.25)" strokeWidth="1.5"/>
<circle cx="36" cy="36" r="18" fill="rgba(55,224,197,0.1)" stroke="rgba(55,224,197,0.3)" strokeWidth="1"/>
<text x="36" y="41" textAnchor="middle" fontSize="22" fill="rgba(242,240,250,0.9)">👨‍🚀</text>
<circle cx="36" cy="36" r="34" fill="none" stroke="rgba(55,224,197,0.06)" strokeWidth="1" strokeDasharray="2 6"/>
</svg>
</div>
</div>

{/* Detail drawer */}
{selected&&(
<div style={{position:'fixed',right:0,top:0,bottom:0,width:340,background:'#0d0d14',borderLeft:'1px solid rgba(55,224,197,0.2)',zIndex:100,padding:28,display:'flex',flexDirection:'column',gap:16,boxShadow:'-20px 0 60px rgba(0,0,0,0.6)'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<span style={{fontSize:13,fontWeight:700,color:'#37e0c5',letterSpacing:1}}>DEAL</span>
<button onClick={()=>setSelected(null)} style={{background:'transparent',border:'none',color:'rgba(242,240,250,0.4)',fontSize:18,cursor:'pointer',lineHeight:1}}>✕</button>
</div>
<div>
<div style={{fontSize:17,fontWeight:700,color:'#f2f0fa',marginBottom:4}}>{selected.name}</div>
<div style={{fontSize:12,color:'rgba(242,240,250,0.5)'}}>{selected.company}</div>
{selected.phone&&<div style={{fontSize:12,color:'rgba(242,240,250,0.4)',marginTop:2}}>{selected.phone}</div>}
</div>
<div style={{fontSize:24,fontWeight:800,fontFamily:'monospace',color:'#37e0c5'}}>{fmt(selected.value)}</div>
<div style={{display:'flex',flexDirection:'column',gap:8}}>
<label style={{fontSize:11,color:'rgba(242,240,250,0.4)',letterSpacing:1}}>MOVE TO STAGE</label>
<select value={moveStageId} onChange={e=>setMoveStageId(e.target.value)} style={{background:'#1a1a28',border:'1px solid rgba(55,224,197,0.25)',color:'#f2f0fa',borderRadius:8,padding:'8px 12px',fontSize:13,cursor:'pointer'}}>
{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
</select>
<button onClick={saveMove} disabled={moveSaving||moveStageId===selected.stage_id} style={{background:'rgba(55,224,197,0.15)',border:'1px solid rgba(55,224,197,0.4)',color:'#37e0c5',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer',fontWeight:600,opacity:moveSaving||moveStageId===selected.stage_id?.5:1}}>
{moveSaving?'Moving...':'Move'}
</button>
</div>
</div>
)}

{/* New Lead Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(6,6,8,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setModal(false)}>
<div style={{background:'#0d0d14',border:'1px solid rgba(55,224,197,0.25)',borderRadius:16,padding:32,width:400,display:'flex',flexDirection:'column',gap:16}} onClick={e=>e.stopPropagation()}>
<div style={{fontSize:14,fontWeight:700,color:'#37e0c5',letterSpacing:1,marginBottom:4}}>NEW LEAD</div>
{[['Name',ldName,setLdName,'text'],['Phone',ldPhone,setLdPhone,'tel'],['Company',ldCat,setLdCat,'text']].map(([label,val,setter,type])=>(
<div key={label as string} style={{display:'flex',flexDirection:'column',gap:4}}>
<label style={{fontSize:11,color:'rgba(242,240,250,0.4)',letterSpacing:1}}>{label as string}</label>
<input type={type as string} value={val as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)} style={{background:'#1a1a28',border:'1px solid rgba(55,224,197,0.2)',color:'#f2f0fa',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none'}}/>
</div>
))}
<div style={{display:'flex',flexDirection:'column',gap:4}}>
<label style={{fontSize:11,color:'rgba(242,240,250,0.4)',letterSpacing:1}}>VALUE ($)</label>
<input type="number" value={ldValue} onChange={e=>setLdValue(+e.target.value)} style={{background:'#1a1a28',border:'1px solid rgba(55,224,197,0.2)',color:'#f2f0fa',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none'}}/>
</div>
<div style={{display:'flex',flexDirection:'column',gap:4}}>
<label style={{fontSize:11,color:'rgba(242,240,250,0.4)',letterSpacing:1}}>STAGE</label>
<select value={ldStage||orbitKeys[0]} onChange={e=>setLdStage(e.target.value)} style={{background:'#1a1a28',border:'1px solid rgba(55,224,197,0.2)',color:'#f2f0fa',borderRadius:8,padding:'8px 12px',fontSize:13,cursor:'pointer'}}>
{orbitKeys.map(k=><option key={k} value={k}>{k}</option>)}
</select>
</div>
<div style={{display:'flex',flexDirection:'column',gap:4}}>
<label style={{fontSize:11,color:'rgba(242,240,250,0.4)',letterSpacing:1}}>NOTES</label>
<textarea value={ldMsg} onChange={e=>setLdMsg(e.target.value)} rows={3} style={{background:'#1a1a28',border:'1px solid rgba(55,224,197,0.2)',color:'#f2f0fa',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none',resize:'none'}}/>
</div>
<div style={{display:'flex',gap:12}}>
<button onClick={()=>setModal(false)} style={{flex:1,background:'transparent',border:'1px solid rgba(242,240,250,0.15)',color:'rgba(242,240,250,0.5)',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer'}}>Cancel</button>
<button onClick={saveLead} disabled={ldSaving} style={{flex:2,background:'rgba(55,224,197,0.15)',border:'1px solid rgba(55,224,197,0.4)',color:'#37e0c5',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer',fontWeight:600,opacity:ldSaving?.5:1}}>{ldSaving?'Saving...':'Add Lead'}</button>
</div>
</div>
</div>
)}

<style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
</div>
);
}
