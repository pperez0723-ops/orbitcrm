import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import TasksClient from './TasksClient';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const [{ data: tasks }, { data: contacts }] = await Promise.all([
    supabase.from('tasks').select('*, contacts(fname,lname)').eq('workspace_id', workspaceId!).order('done').order('due_date', { ascending: true }),
    supabase.from('contacts').select('id,fname,lname').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }).limit(200),
  ]);
  return <TasksClient workspaceId={workspaceId!} initial={tasks || []} contacts={contacts || []} />;
}
