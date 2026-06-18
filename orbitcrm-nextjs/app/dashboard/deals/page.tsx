// @ts-nocheck
/* eslint-disable */
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

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id,name')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .maybeSingle();

  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase.from('stages').select('*').eq('workspace_id', workspaceId).eq('pipeline_id', pipeline?.id).order('sort_order'),
    supabase.from('deals').select('*, contacts(fname,lname,company,phone)').eq('workspace_id', workspaceId).eq('pipeline_id', pipeline?.id),
  ]);

  const stageMap: Record<string, string> = {};
  (stages || []).forEach((s: any) => { stageMap[s.id] = s.name; });

  return (
    <OrbitalPipeline
      workspaceId={workspaceId}
      pipelineId={pipeline?.id || null}
      stages={stages || []}
      initialDeals={(deals || []).map((d: any) => ({
        id: d.id,
        name: d.title || 'Unnamed',
        company: d.contacts?.company || [d.contacts?.fname, d.contacts?.lname].filter(Boolean).join(' ') || '',
        phone: d.contacts?.phone || '',
        value: d.value || 0,
        stage_id: d.stage_id,
        contact_id: d.contact_id,
        status: stageMap[d.stage_id] || 'New Lead',
        contacts: d.contacts,
      }))}
    />
  );
}
