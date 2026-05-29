import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import DealsBoard from './DealsBoard';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();

  const { data: pipeline } = await supabase.from('pipelines')
    .select('id,name').eq('workspace_id', workspaceId!).eq('is_default', true).maybeSingle();

  const [{ data: stages }, { data: deals }, { data: contacts }] = await Promise.all([
    supabase.from('stages').select('*').eq('workspace_id', workspaceId!).order('sort_order'),
    supabase.from('deals').select('*, contacts(fname,lname,company)').eq('workspace_id', workspaceId!),
    supabase.from('contacts').select('id,fname,lname,company').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }).limit(200),
  ]);

  return <DealsBoard
    workspaceId={workspaceId!}
    pipelineId={pipeline?.id || null}
    stages={stages || []}
    initialDeals={deals || []}
    contacts={contacts || []}
  />;
}
