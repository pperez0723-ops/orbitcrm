import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import OrbitalPipeline from './OrbitalPipeline';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();

  if (!workspaceId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060608', color: 'rgba(242,240,250,0.4)', fontFamily: 'monospace', fontSize: 13 }}>
        No workspace found. Please complete onboarding.
      </div>
    );
  }

  // Fetch pipeline stages for this workspace
  const { data: stagesRaw } = await supabase
    .from('stages')
    .select('id, name, color, is_won, is_lost, sort_order')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true });

  // Fetch all deals for this workspace with contact info
  const { data: dealsRaw } = await supabase
    .from('deals')
    .select('id, title, value, stage_id, contact_id, contacts(name, company)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(500);

  const stages = stagesRaw ?? [];
  const deals = (dealsRaw ?? []).map((d: any) => ({
    id: d.id,
    name: d.title || 'Unnamed',
    company: d.contacts?.company || d.contacts?.name || '',
    value: d.value || 0,
    stage_id: d.stage_id,
    // Map stage_id to stage name for orbital display
    status: stages.find((s: any) => s.id === d.stage_id)?.name || 'New Lead',
  }));

  return <OrbitalPipeline initialDeals={deals} stages={stages} workspaceId={workspaceId} />;
}
