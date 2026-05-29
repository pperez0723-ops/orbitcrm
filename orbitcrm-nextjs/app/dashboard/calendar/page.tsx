import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const [{ data: appts }, { data: contacts }] = await Promise.all([
    supabase.from('appointments').select('*, contacts(fname,lname)').eq('workspace_id', workspaceId!).order('starts_at', { ascending: true }),
    supabase.from('contacts').select('id,fname,lname').eq('workspace_id', workspaceId!).order('created_at', { ascending: false }).limit(200),
  ]);
  return <CalendarClient workspaceId={workspaceId!} initial={appts || []} contacts={contacts || []} />;
}
