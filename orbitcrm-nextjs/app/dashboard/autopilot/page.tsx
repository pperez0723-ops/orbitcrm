import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import AutopilotClient from './AutopilotClient';

export const dynamic = 'force-dynamic';

export default async function AutopilotPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const [{ data: settings }, { data: suggestions }, { data: automations }] = await Promise.all([
    supabase.from('autopilot_settings').select('*').eq('workspace_id', workspaceId!).maybeSingle(),
    supabase.from('autopilot_suggestions').select('*, contacts(fname,lname,company)')
      .eq('workspace_id', workspaceId!).eq('status', 'pending').order('score', { ascending: false }).limit(50),
    supabase.from('automations').select('id,name').eq('workspace_id', workspaceId!),
  ]);

  return <AutopilotClient
    initialSettings={settings}
    initialSuggestions={suggestions || []}
    automations={automations || []}
  />;
}
