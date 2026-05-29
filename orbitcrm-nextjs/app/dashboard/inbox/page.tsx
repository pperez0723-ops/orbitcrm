import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import InboxClient from './InboxClient';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: conversations } = await supabase.from('conversations')
    .select('*, contacts(fname,lname,company)')
    .eq('workspace_id', workspaceId!).order('last_message_at', { ascending: false }).limit(50);

  return <InboxClient workspaceId={workspaceId!} conversations={conversations || []} />;
}
