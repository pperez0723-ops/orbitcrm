import { redirect } from 'next/navigation';
import { getMyWorkspace } from '@/lib/workspace';
import Sidebar from '@/components/Sidebar';
import AIAssistant from './AIAssistant';

import Jarvis from '@/components/Jarvis';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, workspaceId } = await getMyWorkspace();
  if (!user) redirect('/login');
  if (!workspaceId) redirect('/onboarding');

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">{children}
      <Jarvis /></div>
      <AIAssistant />
    </div>
  );
}
