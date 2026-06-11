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

  // Use the same proven queries from the original page.tsx
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id,name')
    .eq('workspace_id', workspaceId!)
    .eq('is_default', true)
    .maybeSingle();

  const [{ data: stages }, { data: deals }, { data: contacts }] = await Promise.all([
    supabase.from('stages').select('*').eq('workspace_id', workspaceId!).order('sort_order'),
    supabase.from('deals').select('*, contacts(fname,lname,company)').eq('workspace_id', workspaceId!),
    supabase.from('contacts').select('id,fname,lname,company').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }),
  ]);

  return (
    <OrbitalPipeline
      workspaceId={workspaceId!}
      pipelineId={pipeline?.id || null}
      stages={stages || []}
      initialDeals={(deals || []).map((d: any) => ({
        id: d.id,
        name: d.title || 'Unnamed',
        company: d.contacts?.company || [d.contacts?.fname, d.contacts?.lname].filter(Boolean).join(' ') || '',
        value: d.value || 0,
        stage_id: d.stage_id,
        status: (stages || []).find((s: any) => s.id === d.stage_id)?.name || 'New Lead',
      }))}
    />
  );
}
