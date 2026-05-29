import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: intg } = await supabase.from('integrations').select('*').eq('workspace_id', workspaceId!).maybeSingle();
  return <SettingsClient workspaceId={workspaceId!} initial={intg || {}} />;
}
