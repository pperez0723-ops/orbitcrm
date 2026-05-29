import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import FormsClient from './FormsClient';

export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: forms } = await supabase.from('forms').select('*').eq('workspace_id', workspaceId!).order('created_at', { ascending: false });
  return <FormsClient workspaceId={workspaceId!} initial={forms || []} />;
}
