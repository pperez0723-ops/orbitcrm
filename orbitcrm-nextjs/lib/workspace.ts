// lib/workspace.ts — resolve the logged-in user's workspace (server-side).
import { createClient } from './supabase-server';

export async function getMyWorkspace() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, workspaceId: null as string | null };

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  return { user, workspaceId: (data?.workspace_id as string) || null };
}
