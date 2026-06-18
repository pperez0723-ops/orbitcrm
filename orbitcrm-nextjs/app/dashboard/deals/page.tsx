import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import DealsBoard from './DealsBoard';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
    const { workspaceId } = await getMyWorkspace();
    const supabase = createClient();

  if (!workspaceId) {
        return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060608', color: 'rgba(242,240,250,0.4)', fontFamily: 'monospace', fontSize: 13 }}>
                          No workspace found. Please complete onboarding.
                </div>div>
              );
  }

  const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id,name')
      .eq('workspace_id', workspaceId!)
      .eq('is_default', true)
      .maybeSingle();

  const [{ data: stages }, { data: deals }, { data: contacts }] = await Promise.all([
        supabase.from('stages').select('*').eq('workspace_id', workspaceId!).eq('pipeline_id', pipeline?.id).order('sort_order'),
        supabase.from('deals').select('*, contacts(fname,lname,company)').eq('workspace_id', workspaceId!).eq('pipeline_id', pipeline?.id),
        supabase.from('contacts').select('id,fname,lname,company').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }),
      ]);

  return (
        <DealsBoard
                workspaceId={workspaceId!}
                pipelineId={pipeline?.id || null}
                stages={(stages || []).map((s: any) => ({
                          id: s.id,
                          name: s.name,
                          color: s.color || '#37e0c5',
                          probability: s.probability || 0,
                          is_won: s.is_won || false,
                          is_lost: s.is_lost || false,
                }))}
                initialDeals={(deals || []).map((d: any) => ({
                          id: d.id,
                          title: d.title || 'Unnamed Deal',
                          value: d.value || 0,
                          stage_id: d.stage_id,
                          contact_id: d.contact_id,
                          contacts: d.contacts,
                }))}
                contacts={contacts || []}
              />
      );
}
