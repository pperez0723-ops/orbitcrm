import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import CampaignsClient from './CampaignsClient';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: campaigns } = await supabase.from('campaigns').select('*').eq('workspace_id', workspaceId!).order('created_at', { ascending: false });
  return <CampaignsClient initial={campaigns || []} />;
}
