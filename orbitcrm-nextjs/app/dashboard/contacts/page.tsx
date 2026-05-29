import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import ContactsClient from './ContactsClient';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  return <ContactsClient initial={contacts || []} workspaceId={workspaceId!} />;
}
