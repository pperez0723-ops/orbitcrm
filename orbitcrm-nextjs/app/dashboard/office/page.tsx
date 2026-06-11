'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CREW = [
  { id:'nova', name:'NOVA', role:'Director', emoji:'🚀', color:'#00D4FF', status:'active' },
  { id:'astra', name:'ASTRA', role:'Lead Gen', emoji:'⭐', color:'#F59E0B', status:'working' },
  { id:'orion', name:'ORION', role:'Web Dev', emoji:'🌍', color:'#10B981', status:'active' },
  { id:'luna', name:'LUNA', role:'App Dev', emoji:'🌙', color:'#A78BFA', status:'standby' },
];

export default function OfficePage() {
  const [stats, setStats] = useState({ contacts: 0, deals: 0, leads: 0 });
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [{ count: contacts }, { count: deals }, { count: leads }, { data: recent }] = await Promise.all([
        sb.from('contacts').select('*', { count:'exact', head:true }),
        sb.from('deals').select('*', { count:'exact', head:true }),
        sb.from('leads').select('*', { count:'exact', head:true }),
        sb.from('contacts').select('id, full_name, company, created_at').order('created_at',{ascending:false}).limit(8)
      ]);
      setStats({ contacts: contacts||0, deals: deals||0, leads: leads||0 });
      setActivity((recent||[]).map((c:any) => ({ type:'contact', name: c.full_name||'Unknown', sub: c.company||'Contact', time: c.created_at })));
    }
    load();
  }, []);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#050A14',color:'#fff',fontFamily:"'Rajdhani',sans-serif",overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet"/>
      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
        <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#10B981',boxShadow:'0 0 8px #10B981',animation:'none'}}></div>
        <div>
          <div style={{fontSize:'17px',fontWeight:700,color:'#00D4FF',letterSpacing:'3px',textTransform:'uppercase'}}>Mission HQ</div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',fontFamily:"'Space Mono'",letterSpacing:'1px'}}>ORBITCRM · LIVE OPERATIONS</div>
        </div>
      </div>
      {/* Main layout */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden'}}>
        {/* Left: Crew */}
        <div style={{padding:'18px',borderRight:'1px solid rgba(255,255,255,0.06)',overflow:'auto',background:'linear-gradient(180deg,#0A1628 0%,#050A14 100%)'}}>
          <div style={{fontSize:'10px',letterSpacing:'3px',color:'rgba(0,212,255,0.5)',textTransform:'uppercase',marginBottom:'16px',fontFamily:"'Space Mono'"}}>▸ CREW STATION</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            {CREW.map(agent => (
              <div key={agent.id} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'10px',padding:'14px',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
                <div style={{width:'50px',height:'50px',borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:'2px solid '+agent.color+'40',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px'}}>{agent.emoji}</div>
                <div style={{fontSize:'12px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase'}}>{agent.name}</div>
                <div style={{fontSize:'9px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',textTransform:'uppercase',fontFamily:"'Space Mono'",textAlign:'center'}}>{agent.role}</div>
                <div style={{fontSize:'9px',padding:'2px 8px',borderRadius:'10px',letterSpacing:'1px',textTransform:'uppercase',fontFamily:"'Space Mono'",
                  background: agent.status==='active' ? 'rgba(16,185,129,0.15)' : agent.status==='working' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                  color: agent.status==='active' ? '#10B981' : agent.status==='working' ? '#F59E0B' : '#9CA3AF',
                  border: '1px solid '+(agent.status==='active' ? 'rgba(16,185,129,0.3)' : agent.status==='working' ? 'rgba(245,158,11,0.3)' : 'rgba(107,114,128,0.2)')
                }}>{agent.status}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Right: Activity */}
        <div style={{padding:'18px',overflow:'auto'}}>
          <div style={{fontSize:'10px',letterSpacing:'3px',color:'rgba(139,92,246,0.6)',textTransform:'uppercase',marginBottom:'16px',fontFamily:"'Space Mono'"}}>▸ RECENT ACTIVITY</div>
          {activity.length === 0 ? (
            <div style={{color:'rgba(255,255,255,0.2)',fontSize:'11px',fontFamily:"'Space Mono'"}}>No activity yet</div>
          ) : activity.map((a,i) => (
            <div key={i} style={{display:'flex',gap:'10px',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <div style={{width:'28px',height:'28px',borderRadius:'6px',background:'rgba(0,212,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',flexShrink:0}}>👤</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'12px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                <div style={{fontSize:'9px',color:'rgba(255,255,255,0.35)',marginTop:'2px',fontFamily:"'Space Mono'"}}>{a.sub} · {new Date(a.time).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom stats */}
      <div style={{padding:'10px 20px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:'24px',background:'rgba(0,0,0,0.4)',flexShrink:0}}>
        {[['Contacts', stats.contacts, '#00D4FF'],['Deals', stats.deals, '#A78BFA'],['Leads', stats.leads, '#F59E0B']].map(([label,val,color]) => (
          <div key={label as string} style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{fontSize:'18px',fontWeight:700,color:color as string,fontFamily:"'Space Mono'"}}>{val}</div>
            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',letterSpacing:'1px',textTransform:'uppercase',fontFamily:"'Space Mono'"}}>{label}</div>
          </div>
        ))}
        <div style={{marginLeft:'auto',fontSize:'10px',color:'rgba(16,185,129,0.7)',fontFamily:"'Space Mono'"}}>● CREW ONLINE 4/4</div>
      </div>
    </div>
  );
}