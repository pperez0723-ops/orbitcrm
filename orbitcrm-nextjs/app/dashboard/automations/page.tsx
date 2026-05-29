import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import AutomationsClient from './AutomationsClient';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: automations } = await supabase.from('automations')
    .select('*').eq('workspace_id', workspaceId!).order('created_at', { ascending: false });
  return <AutomationsClient workspaceId={workspaceId!} initial={automations || []} />;
}
