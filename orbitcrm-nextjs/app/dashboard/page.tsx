import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import Briefing from './Briefing';

export default async function Dashboard() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();

  // Real counts from the database (RLS scopes them to this workspace).
  const [{ count: contacts }, { data: deals }, { count: tasks }] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('deals').select('value'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('done', false),
  ]);

  const pipeline = (deals || []).reduce((s, d: any) => s + (Number(d.value) || 0), 0);

  return (
    <>
      <div className="top"><div className="top-title">Mission Control</div></div>
      <div className="content">
        <Briefing />
        <div className="stat-row">
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--red)' }}>
            <div className="stat-label">Total Contacts</div>
            <div className="stat-num">{contacts ?? 0}</div>
          </div>
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--teal)' }}>
            <div className="stat-label">Pipeline Value</div>
            <div className="stat-num">${pipeline >= 1000 ? (pipeline / 1000).toFixed(1) + 'K' : pipeline}</div>
          </div>
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--gold)' }}>
            <div className="stat-label">Open Deals</div>
            <div className="stat-num">{deals?.length ?? 0}</div>
          </div>
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--purple)' }}>
            <div className="stat-label">Pending Tasks</div>
            <div className="stat-num">{tasks ?? 0}</div>
          </div>
        </div>
        <div className="panel">
          <div style={{ fontFamily: 'Rajdhani', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-sec)', marginBottom: 10 }}>
            Welcome aboard
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.7 }}>
            This is your live workspace. Data here is stored in your real database and shared
            across your team and devices — not trapped in one browser. Head to{' '}
            <a href="/dashboard/contacts" style={{ color: 'var(--red)' }}>Contacts</a> to add
            your first lead and watch it persist.
          </p>
        </div>
      </div>
    </>
  );
}
