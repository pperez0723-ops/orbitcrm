'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STAGES = ['New Lead','SMS Drafted','Contacted','Replied','Won','Lost'];
const COLORS: Record<string,string> = {
  'New Lead':'#E8303A','SMS Drafted':'#F59E0B','Contacted':'#3B82F6',
  'Replied':'#8B5CF6','Won':'#10B981','Lost':'#6B7280'
};

export default function DealsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await sb.from('deals').select('*').order('created_at',{ascending:false}).limit(200);
      setDeals(data || []);
      setLoading(false);
    }
    load();
    const ch = sb.channel('deals-rt').on('postgres_changes',{event:'*',schema:'public',table:'deals'},() => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  const byStage: Record<string,any[]> = {};
  STAGES.forEach(s => byStage[s] = []);
  deals.forEach(d => {
    const s = d.stage || 'New Lead';
    if (!byStage[s]) byStage[s] = [];
    byStage[s].push(d);
  });

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#050A14',color:'#fff',fontFamily:"'Rajdhani',sans-serif",overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet"/>
      {/* Header */}
      <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(5,10,20,0.98)',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
        <div>
          <div style={{fontSize:'17px',fontWeight:700,color:'#00D4FF',letterSpacing:'3px',textTransform:'uppercase'}}>⚡ Orbit Pipeline</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',fontFamily:"'Space Mono'",letterSpacing:'1px'}}>MISSION CONTROL · LIVE DATA</div>
        </div>
        <div style={{marginLeft:'auto',background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.3)',padding:'3px 12px',borderRadius:'20px',fontSize:'12px',color:'#00D4FF',fontFamily:"'Space Mono'"}}>
          {loading ? '...' : deals.length} DEALS
        </div>
      </div>
      {/* Board */}
      <div style={{flex:1,display:'flex',gap:'12px',padding:'14px 18px',overflowX:'auto',overflowY:'hidden',alignItems:'flex-start'}}>
        {STAGES.map(stage => {
          const cards = byStage[stage] || [];
          const color = COLORS[stage] || '#888';
          return (
            <div key={stage} style={{flex:'0 0 210px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',overflow:'hidden',display:'flex',flexDirection:'column'}}>
              {/* Column header */}
              <div style={{padding:'10px 12px',display:'flex',alignItems:'center',gap:'8px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:color,boxShadow:0+' 0 6px '+color+'60',flexShrink:0}}></div>
                <span style={{fontSize:'10px',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',color:'rgba(255,255,255,0.8)'}}>{stage}</span>
                <span style={{marginLeft:'auto',fontSize:'9px',fontFamily:"'Space Mono'",color:'rgba(255,255,255,0.35)',background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:'8px'}}>{cards.length}</span>
              </div>
              {/* Cards */}
              <div style={{padding:'8px',display:'flex',flexDirection:'column',gap:'6px',overflowY:'auto',maxHeight:'calc(100vh - 160px)'}}>
                {cards.length === 0 ? (
                  <div style={{padding:'16px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:'10px',fontFamily:"'Space Mono'"}}>Empty</div>
                ) : cards.map((c,i) => {
                  const name = c.title || c.contact_name || 'Untitled';
                  const company = c.company || c.contact_company || '';
                  const value = c.value ? '$'+Number(c.value).toLocaleString() : '';
                  const score = c.ai_score ? 'AI:'+c.ai_score : '';
                  const dt = c.created_at ? new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
                  return (
                    <div key={i} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'7px',padding:'9px 10px',cursor:'pointer',transition:'all .2s'}}>
                      <div style={{fontSize:'12px',fontWeight:600,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:'2px'}}>{name}</div>
                      {company && <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:'5px'}}>{company}</div>}
                      <div style={{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap'}}>
                        {value && <span style={{fontSize:'9px',fontFamily:"'Space Mono'",color:'#4ADE80',background:'rgba(74,222,128,0.1)',padding:'1px 5px',borderRadius:'3px'}}>{value}</span>}
                        {score && <span style={{fontSize:'9px',background:'rgba(139,92,246,0.15)',color:'#A78BFA',padding:'1px 5px',borderRadius:'3px',border:'1px solid rgba(139,92,246,0.2)'}}>{score}</span>}
                        {dt && <span style={{fontSize:'9px',color:'rgba(255,255,255,0.25)',marginLeft:'auto',fontFamily:"'Space Mono'"}}>{dt}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}