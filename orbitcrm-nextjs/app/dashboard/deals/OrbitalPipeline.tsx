'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';

const RING_SIZES = [{rx:70,ry:40},{rx:132,ry:74},{rx:194,ry:108},{rx:256,ry:142},{rx:318,ry:176},{rx:370,ry:200},{rx:420,ry:224},{rx:460,ry:244}];
const GEM_PALETTE = ['#37e0c5','#F4B942','#A78BFA','#5fd0ff','#36d399','#f87171','#fb923c','#a3e635'];

type Deal = {id:string;name:string;company:string;phone:string;value:number;status:string;stage_id:string;contact_id:string;contacts?:{fname?:string;lname?:string;company?:string;phone?:string}};
type Totals = Record<string,{count:number;value:number}>;

interface Props {
  initialDeals: Deal[];
  stages: {id:string;name:string;color:string|null;is_won:boolean;is_lost:boolean;sort_order:number}[];
  workspaceId: string;
  pipelineId: string|null;
}

function gemSVG(fill:string,uid:string):string{return `<svg viewBox="0 0 40 40" width="40" height="40"><defs><filter id="gf${uid}"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><polygon points="20,3 36,14 30,36 10,36 4,14" fill="${fill}" opacity=".14" stroke="${fill}" stroke-width="1.2" filter="url(#gf${uid})"/><polygon points="20,7 33,16 27,33 13,33 7,16" fill="${fill}" opacity=".32"/><polygon points="20,11 29,19 25,30 15,30 11,19" fill="${fill}" opacity=".75"/><polygon points="20,16 27,22 24,29 16,29 13,22" fill="rgba(255,255,255,0.3)"/></svg>`;}
function fmt(v:number):string{return v>=1000?'$'+(v/1000).toFixed(1)+'K':'$'+v.toFixed(0);}

export default function OrbitalPipeline({initialDeals,stages,workspaceId,pipelineId}:Props){
  const supabase=createClient();
  const wrapRef=useRef<HTMLDivElement>(null);
  const nodesRef=useRef<HTMLDivElement>(null);
  const animRef=useRef<number>(0);
  const gemAnimRef=useRef<number>(0);
  const tRef=useRef(0);
  const gemTRef=useRef(0);
  const [deals,setDeals]=useState<Deal[]>(initialDeals);
  const [totals,setTotals]=useState<Totals>(()=>{
    const t:Totals={};
    stages.forEach(s=>{t[s.name]={count:0,value:0};});
    initialDeals.forEach(d=>{if(t[d.status]){t[d.status].count++;t[d.status].value+=d.value;}});
    return t;
  });
  const [filter,setFilter]=useState('all');
  const [clock,setClock]=useState('--:--:--');
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

  const orbitKeys=stages.map(s=>s.name);
  const orbits:Record<string,{rx:number;ry:number}>={};
  const gemCols:Record<string,string>={};
  stages.forEach((s,i)=>{orbits[s.name]=RING_SIZES[i]||RING_SIZES[RING_SIZES.length-1];gemCols[s.name]=s.color||GEM_PALETTE[i%GEM_PALETTE.length];});

  useEffect(()=>{
    const t=setInterval(()=>setClock(new Date().toLocaleTimeString('en-US',{hour12:false})),1000);
    setClock(new Date().toLocaleTimeString('en-US',{hour12:false}));
    return ()=>clearInterval(t);
  },[]);

  const stageDeals=useRef<Record<string,Deal[]>>({});

  const renderNodes=useCallback(()=>{
    const wrap=wrapRef.current,container=nodesRef.current;
    if(!wrap||!container)return;
    const W=wrap.offsetWidth,H=wrap.offsetHeight;
    const s=Math.min(W/800,H/480);
    const offX=(W-800*s)/2,offY=(H-480*s)/2;
    const cx=400,cy=250;
    const ast=wrap.querySelector('#center-astronaut') as HTMLElement|null;
    if(ast){ast.style.left=(offX+cx*s)+'px';ast.style.top=(offY+cy*s)+'px';}
    container.innerHTML='';
    stageDeals.current={};
    orbitKeys.forEach(k=>{stageDeals.current[k]=[];});
    deals.forEach(d=>{if(stageDeals.current[d.status])stageDeals.current[d.status].push(d);});
    orbitKeys.forEach(stage=>{
      if(filter!=='all'&&filter!==stage)return;
      const list=stageDeals.current[stage]||[];
      const orbit=orbits[stage]||RING_SIZES[0];
      const col=gemCols[stage]||'#37e0c5';
      list.forEach((deal,idx)=>{
        const count=Math.max(list.length,1);
        const angle=(idx/count)*2*Math.PI-Math.PI/2;
        const px=offX+(cx+orbit.rx*Math.cos(angle))*s;
        const py=offY+(cy+orbit.ry*Math.sin(angle))*s;
        const uid=stage.replace(/\s/g,'')+idx;
        const node=document.createElement('div');
        node.className='deal-node';
        node.style.cssText=`position:absolute;transform:translate(-50%,-50%);cursor:pointer;z-index:10;transition:transform .15s;left:${px}px;top:${py}px`;
        node.dataset.rx=String(orbit.rx);
        node.dataset.ry=String(orbit.ry);
        node.dataset.idx=String(idx);
        node.dataset.count=String(count);
        node.dataset.dealid=deal.id;
        node.innerHTML=`<div style="width:40px;height:40px">${gemSVG(col,uid)}</div><div style="position:absolute;bottom:48px;left:50%;transform:translateX(-50%);background:#111119;border:1px solid ${col}44;border-radius:10px;padding:9px 12px;width:160px;z-index:30;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 8px 30px rgba(0,0,0,.6)" class="gem-popup"><div style="font-size:11.5px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f2f0fa">${deal.name}</div><div style="font-size:10px;color:rgba(242,240,250,0.5);margin-bottom:4px">${deal.company||''}</div><div style="font-family:monospace;font-size:15px;font-weight:700;color:${col}">${fmt(deal.value)}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(242,240,250,0.5);margin-top:1px">${stage}</div><div style="font-size:9px;color:${col};margin-top:3px;opacity:.7">click to open ▶</div></div>`;
        node.addEventListener('mouseenter',()=>{const p=node.querySelector('.gem-popup') as HTMLElement|null;if(p)p.style.opacity='1';node.style.transform='translate(-50%,-50%) scale(1.22)';node.style.zIndex='20';});
        node.addEventListener('mouseleave',()=>{const p=node.querySelector('.gem-popup') as HTMLElement|null;if(p)p.style.opacity='0';node.style.transform='translate(-50%,-50%)';node.style.zIndex='10';});
        node.addEventListener('click',()=>{setSelected(deal);setMoveStageId(deal.stage_id);});
        container.appendChild(node);
      });
    });
  },[deals,filter,orbitKeys.join(',')]);/* eslint-disable-line react-hooks/exhaustive-deps */

  useEffect(()=>{
    const dots=[{id:'od1',rx:70,ry:40,speed:.5,offset:0},{id:'od2',rx:132,ry:74,speed:.32,offset:2.1},{id:'od3',rx:194,ry:108,speed:.22,offset:3.5},{id:'od4',rx:256,ry:142,speed:.16,offset:5.2},{id:'od5',rx:70,ry:40,speed:.5,offset:Math.PI},{id:'od6',rx:132,ry:74,speed:.32,offset:Math.PI+1.4}];
    const cx=400,cy=250;
    function animate(){
      tRef.current+=0.009;const t=tRef.current;const wrap=wrapRef.current;
      if(!wrap){animRef.current=requestAnimationFrame(animate);return;}
      const W=wrap.offsetWidth,H=wrap.offsetHeight;const sc=Math.min(W/800,H/480);
      const offX=(W-800*sc)/2,offY=(H-480*sc)/2;
      dots.forEach(d=>{const el=wrap.querySelector('#'+d.id) as SVGCircleElement|null;if(!el)return;const a=d.offset+t*d.speed;el.setAttribute('cx',String(offX+(cx+d.rx*Math.cos(a))*sc));el.setAttribute('cy',String(offY+(cy+d.ry*Math.sin(a))*sc));});
      animRef.current=requestAnimationFrame(animate);
    }
    animate();return()=>cancelAnimationFrame(animRef.current);
  },[]);

  useEffect(()=>{
    function loop(){
      gemTRef.current+=0.0014;const gt=gemTRef.current;const wrap=wrapRef.current;
      if(!wrap){gemAnimRef.current=requestAnimationFrame(loop);return;}
      const W=wrap.offsetWidth,H=wrap.offsetHeight;const sc=Math.min(W/800,H/480);
      const offX=(W-800*sc)/2,offY=(H-480*sc)/2;const cx=400,cy=250;
      nodesRef.current?.querySelectorAll('.deal-node').forEach(n=>{
        const el=n as HTMLElement;
        const rx=+el.dataset.rx!,ry=+el.dataset.ry!,idx=+el.dataset.idx!,count=+el.dataset.count!;
        const speed=60/(rx+30);const a=(idx/count)*2*Math.PI-Math.PI/2+gt*speed;
        el.style.left=(offX+(cx+rx*Math.cos(a))*sc)+'px';
        el.style.top=(offY+(cy+ry*Math.sin(a))*sc)+'px';
      });
      gemAnimRef.current=requestAnimationFrame(loop);
    }
    loop();return()=>cancelAnimationFrame(gemAnimRef.current);
  },[renderNodes]);

  useEffect(()=>{window.addEventListener('resize',renderNodes);return()=>window.removeEventListener('resize',renderNodes);},[renderNodes]);
  useEffect(()=>{renderNodes();},[renderNodes]);

  async function moveStage(){
    if(!selected||!moveStageId)return;
    setMoveSaving(true);
    const stage=stages.find(s=>s.id===moveStageId);
    const patch:any={stage_id:moveStageId};
    if(stage?.is_won)patch.won_at=new Date().toISOString();
    if(stage?.is_lost)patch.lost_at=new Date().toISOString();
    await supabase.from('deals').update(patch).eq('id',selected.id);
    const newStatus=stage?.name||selected.status;
    setDeals(ds=>ds.map(d=>d.id===selected.id?{...d,stage_id:moveStageId,status:newStatus}:d));
    setSelected(d=>d?{...d,stage_id:moveStageId,status:newStatus}:d);
    setMoveSaving(false);
  }

  async function saveLead(){
    if(!ldName.trim()){setLdMsg('Enter a business name.');return;}
    setLdSaving(true);setLdMsg('');
    try{
      const res=await fetch('https://jlbnieorltkfezixulxc.supabase.co/functions/v1/add-lead',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':'whk_orbit_9f3c1a7e8b2d4056aa1199ccee'},body:JSON.stringify({business_name:ldName,phone:ldPhone,category:ldCat,value:ldValue,stage:ldStage,workspace_id:workspaceId})});
      if(!res.ok)throw new Error(await res.text());
      const stageKey=ldStage||orbitKeys[0]||'New Lead';
      const newDeal:Deal={id:crypto.randomUUID(),name:ldName,company:ldCat,phone:ldPhone,value:ldValue,status:stageKey,stage_id:'',contact_id:'',contacts:undefined};
      setDeals(prev=>[...prev,newDeal]);
      setTotals(prev=>{const t={...prev};if(!t[stageKey])t[stageKey]={count:0,value:0};t[stageKey]={count:t[stageKey].count+1,value:t[stageKey].value+ldValue};return t;});
      setLdMsg('\u2713 Lead added!');
      setTimeout(()=>{setModal(false);setLdName('');setLdPhone('');setLdCat('');setLdValue(500);setLdMsg('');},1200);
    }catch(e:any){setLdMsg('\u26a0 '+e.message);}
    finally{setLdSaving(false);}
  }

  const totalValue=deals.reduce((a,d)=>a+d.value,0);
  const selStage=stages.find(s=>s.id===selected?.stage_id);
  const selCol=selStage?gemCols[selStage.name]||'#37e0c5':'#37e0c5';

  return(
    <div style={{position:'relative',width:'100%',height:'100%',minHeight:500,background:'#060608',fontFamily:"'Rajdhani','Inter',sans-serif",color:'#f2f0fa',overflow:'hidden'}}>
      {/* Top bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:5,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px 0',pointerEvents:'none'}}>
        <div style={{pointerEvents:'auto'}}>
          <div style={{fontWeight:700,fontSize:17,letterSpacing:1}}>ORBIT PIPELINE</div>
          <div style={{fontSize:11,color:'rgba(242,240,250,0.4)',marginTop:2,fontFamily:'monospace'}}>{clock} &nbsp;|&nbsp; {deals.length} leads &nbsp;|&nbsp; {fmt(totalValue)}</div>
        </div>
        <div style={{display:'flex',gap:8,pointerEvents:'auto'}}>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:'#111119',border:'1px solid rgba(55,224,197,0.2)',borderRadius:8,padding:'5px 10px',color:'#f2f0fa',fontSize:12,cursor:'pointer'}}>
            <option value="all">All Stages</option>
            {orbitKeys.map(k=><option key={k} value={k}>{k}</option>)}
          </select>
          <button onClick={()=>setModal(true)} style={{padding:'6px 14px',background:'rgba(55,224,197,0.15)',border:'1px solid rgba(55,224,197,0.35)',borderRadius:9,color:'#37e0c5',cursor:'pointer',fontWeight:600,fontSize:12}}>+ New Lead</button>
        </div>
      </div>

      {/* Stage totals */}
      <div style={{position:'absolute',top:60,left:0,right:0,zIndex:5,display:'flex',gap:4,justifyContent:'center',padding:'0 14px',pointerEvents:'none'}}>
        {orbitKeys.map(k=>{const col=gemCols[k]||'#37e0c5';return(
          <div key={k} style={{flex:1,maxWidth:130,background:'rgba(17,17,25,0.72)',border:`1px solid ${col}33`,borderRadius:10,padding:'6px 9px',backdropFilter:'blur(6px)'}}>
            <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.1,color:col,marginBottom:2}}>{k}</div>
            <div style={{fontSize:13,fontWeight:700}}>{totals[k]?.count||0}</div>
            <div style={{fontSize:10,color:'rgba(242,240,250,0.4)',fontFamily:'monospace'}}>{fmt(totals[k]?.value||0)}</div>
          </div>);})}
      </div>

      {/* Canvas */}
      <div ref={wrapRef} style={{position:'absolute',inset:0}}>
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible'}} viewBox="0 0 800 480" preserveAspectRatio="xMidYMid meet">
          <defs><filter id="gr"><feGaussianBlur stdDeviation="1.5"/></filter><filter id="gs"><feGaussianBlur stdDeviation="2.5"/></filter></defs>
          {stages.map((s,i)=>{const ring=RING_SIZES[i]||RING_SIZES[RING_SIZES.length-1];const col=gemCols[s.name]||GEM_PALETTE[i%GEM_PALETTE.length];return(<ellipse key={s.id} cx="400" cy="250" rx={ring.rx} ry={ring.ry} fill="none" stroke={col} strokeWidth={filter==='all'||filter===s.name?0.8:0.15} opacity={filter==='all'||filter===s.name?0.35:0.08} strokeDasharray="3 7"/>);})}
          <circle id="od1" r="4.5" fill="rgba(55,224,197,0.95)" filter="url(#gr)"/>
          <circle id="od2" r="3.5" fill="rgba(167,139,250,0.85)" filter="url(#gs)"/>
          <circle id="od3" r="3" fill="rgba(244,185,66,0.85)" filter="url(#gs)"/>
          <circle id="od4" r="2.5" fill="rgba(95,208,255,0.85)"/>
          <circle id="od5" r="2.5" fill="rgba(55,224,197,0.6)"/>
          <circle id="od6" r="2" fill="rgba(244,185,66,0.5)"/>
        </svg>
        <div ref={nodesRef} style={{position:'absolute',inset:0,pointerEvents:'none'}}/>
        <div id="center-astronaut" style={{position:'absolute',transform:'translate(-50%,-50%)',width:120,height:120,pointerEvents:'none'}}>
          <svg viewBox="0 0 80 80" width="66" height="66" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="53" rx="15.5" ry="12.5" fill="#1a0508" stroke="rgba(232,48,58,0.4)" strokeWidth=".8"/>
            <ellipse cx="23.5" cy="48" rx="5" ry="9" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth="1"/>
            <ellipse cx="56.5" cy="48" rx="5" ry="9" fill="#1a0508" stroke="rgba(232,48,58,0.3)" strokeWidth="1"/>
            <ellipse cx="17.5" cy="56" rx="4.5" ry="3.5" fill="#120408" stroke="rgba(232,48,58,0.4)" strokeWidth=".8"/>
            <ellipse cx="62.5" cy="56" rx="4.5" ry="3.5" fill="#120408" stroke="rgba(232,48,58,0.4)" strokeWidth=".8"/>
            <rect x="34.5" y="47" width="11" height="9" rx="2" fill="rgba(232,48,58,0.12)" stroke="rgba(232,48,58,0.58)"/>
            <circle cx="40" cy="51.5" r="2" fill="rgba(232,48,58,0.55)"/>
            <rect x="36" y="48.5" width="2.5" height="1.4" rx=".5" fill="rgba(45,212,191,0.55)"/>
            <rect x="41.5" y="48.5" width="2.5" height="1.4" rx=".5" fill="rgba(244,185,66,0.45)"/>
            <ellipse cx="40" cy="29.5" rx="13" ry="15" fill="#1a0508" stroke="rgba(232,48,58,0.62)" strokeWidth="1.4"/>
            <ellipse cx="40" cy="28.5" rx="8" ry="9.5" fill="#050108"/>
            <ellipse cx="36" cy="23.5" rx="2.8" ry="3.5" fill="rgba(255,255,255,0.13)" transform="rotate(-12,36,23.5)"/>
            <circle cx="44" cy="25.5" r=".7" fill="rgba(255,255,255,0.22)"/>
            <ellipse cx="40" cy="15" rx="4.5" ry="1.7" fill="none" stroke="rgba(232,48,58,0.4)" strokeWidth="1"/>
            <line x1="40" y1="14.5" x2="44.5" y2="8" stroke="rgba(232,48,58,0.5)" strokeWidth="1.2"/>
            <circle cx="45" cy="7.5" r="2" fill="#E8303A"/>
            <ellipse cx="45" cy="7.5" rx="3.5" ry="3" fill="rgba(232,48,58,0.3)"/>
            <rect x="32" y="63" width="7" height="11" rx="3" fill="#1a0508" stroke="rgba(232,48,58,0.25)" strokeWidth=".8"/>
            <rect x="41" y="63" width="7" height="11" rx="3" fill="#1a0508" stroke="rgba(232,48,58,0.25)" strokeWidth=".8"/>
          </svg>
        </div>
      </div>

      {/* Deal detail panel */}
      {selected&&(
        <div style={{position:'fixed',inset:0,zIndex:50,pointerEvents:'auto'}} onClick={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
          <div style={{position:'absolute',right:0,top:0,bottom:0,width:340,background:'#0d0d14',borderLeft:'1px solid rgba(55,224,197,0.15)',padding:22,overflowY:'auto',display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:15,fontWeight:700,letterSpacing:.5}}>Deal Detail</span>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'rgba(242,240,250,0.4)',cursor:'pointer',fontSize:18,lineHeight:1}}>x</button>
            </div>
            <div style={{background:'#111119',borderRadius:10,padding:'12px 14px',borderLeft:`3px solid ${selCol}`}}>
              <div style={{fontWeight:700,fontSize:15}}>{selected.name}</div>
              {selected.company&&<div style={{fontSize:12,color:'rgba(242,240,250,0.5)',marginTop:3}}>{selected.company}</div>}
              {(selected.contacts?.fname||selected.contacts?.lname)&&(
                <div style={{fontSize:11,color:'rgba(242,240,250,0.4)',marginTop:2}}>{selected.contacts?.fname} {selected.contacts?.lname||''}</div>
              )}
              {selected.phone&&<div style={{fontSize:11,color:selCol,marginTop:4,fontFamily:'monospace'}}>{selected.phone}</div>}
              <div style={{fontFamily:'monospace',fontSize:18,fontWeight:700,color:selCol,marginTop:8}}>{fmt(selected.value)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:'rgba(242,240,250,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Move Stage</div>
              <select value={moveStageId} onChange={e=>setMoveStageId(e.target.value)} style={{width:'100%',background:'#111119',border:'1px solid rgba(55,224,197,0.2)',borderRadius:8,padding:'8px 10px',color:'#f2f0fa',fontSize:13,boxSizing:'border-box' as any}}>
                {stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:10,marginTop:'auto'}}>
              <button onClick={moveStage} disabled={moveSaving||moveStageId===selected.stage_id} style={{flex:1,padding:'10px 0',background:'rgba(55,224,197,0.15)',border:'1px solid rgba(55,224,197,0.3)',borderRadius:9,color:'#37e0c5',cursor:'pointer',fontWeight:700,fontSize:13}}>
                {moveSaving?'Moving...':'Move'}
              </button>
              <button onClick={()=>setSelected(null)} style={{flex:1,padding:'10px 0',background:'transparent',border:'1px solid rgba(242,240,250,0.1)',borderRadius:9,color:'rgba(242,240,250,0.5)',cursor:'pointer',fontSize:13}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {modal&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(false);}} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(4,4,10,0.75)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:340,background:'#111119',border:'1px solid rgba(232,48,58,0.2)',borderRadius:14,padding:'24px 22px'}}>
            <div style={{fontFamily:'Rajdhani',fontWeight:700,fontSize:18,marginBottom:3}}>New Lead</div>
            <div style={{fontSize:11,color:'rgba(242,240,250,0.3)',marginBottom:16}}>Drops onto the orbit and saves to the DB</div>
            {[['Business name *',ldName,setLdName,'text'],['Phone',ldPhone,setLdPhone,'text'],['Category',ldCat,setLdCat,'text']].map(([ph,val,set,type])=>(
              <input key={ph as string} placeholder={ph as string} value={val as string} onChange={e=>(set as any)(e.target.value)} type={type as string}
                style={{width:'100%',marginBottom:9,padding:'8px 11px',background:'#18181f',border:'1px solid rgba(232,48,58,0.18)',borderRadius:8,color:'#f2f0fa',fontSize:13,boxSizing:'border-box' as any}}/>
            ))}
            <div style={{display:'flex',gap:9,marginBottom:9}}>
              <input type="number" value={ldValue} onChange={e=>setLdValue(Number(e.target.value))} placeholder="Value $" style={{flex:1,padding:'8px 11px',background:'#18181f',border:'1px solid rgba(232,48,58,0.18)',borderRadius:8,color:'#f2f0fa',fontSize:13}}/>
              <select value={ldStage} onChange={e=>setLdStage(e.target.value)} style={{flex:1.3,background:'#18181f',border:'1px solid rgba(232,48,58,0.18)',borderRadius:8,padding:'8px 10px',color:'#f2f0fa',fontSize:13}}>
                <option value="">Stage...</option>
                {orbitKeys.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            {ldMsg&&<div style={{fontSize:11,minHeight:16,marginBottom:8,color:ldMsg.startsWith('\u2713')?'#2DD4BF':ldMsg.startsWith('\u26a0')?'#f87171':'rgba(242,240,250,0.4)'}}>{ldMsg}</div>}
            <div style={{display:'flex',gap:9}}>
              <button onClick={()=>setModal(false)} style={{flex:1,padding:11,borderRadius:9,border:'1px solid rgba(232,48,58,0.2)',background:'transparent',color:'rgba(242,240,250,0.5)',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveLead} disabled={ldSaving} style={{flex:1.4,padding:11,borderRadius:9,border:'none',background:ldSaving?'#333':'rgba(55,224,197,0.9)',color:'#000',cursor:'pointer',fontWeight:700,fontSize:13}}>{ldSaving?'Saving...':'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
