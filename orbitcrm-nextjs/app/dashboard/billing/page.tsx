import { createClient } from '@/lib/supabase-server';
import { getMyWorkspace } from '@/lib/workspace';
import BillingClient from './BillingClient';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const { workspaceId } = await getMyWorkspace();
  const supabase = createClient();
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('workspace_id', workspaceId!).maybeSingle();
  return <BillingClient sub={sub} />;
}
