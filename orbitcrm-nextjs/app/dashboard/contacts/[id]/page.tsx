import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import ContactDetail from './ContactDetail';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ContactPage({ params }: { params: { id: string } }) {
  await getMyWorkspace();
  const supabase = createClient();
  const { data: contact } = await supabase.from('contacts').select('*').eq('id', params.id).maybeSingle();
  if (!contact) notFound();

  const [{ data: notes }, { data: activity }, { data: deals }] = await Promise.all([
    supabase.from('notes').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }),
    supabase.from('activity').select('*').eq('contact_id', params.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('deals').select('*').eq('contact_id', params.id),
  ]);

  return <ContactDetail contact={contact} notes={notes || []} activity={activity || []} deals={deals || []} />;
}
