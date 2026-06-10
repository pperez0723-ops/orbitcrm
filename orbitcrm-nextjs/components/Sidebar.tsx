'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const NAV = [
  { href: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { href: '/dashboard/contacts', icon: 'ti-users', label: 'Contacts' },
  { href: '/dashboard/deals', icon: 'ti-layout-kanban', label: 'Pipeline' },
  { href: '/dashboard/inbox', icon: 'ti-inbox', label: 'Inbox' },
  { href: '/dashboard/automations', icon: 'ti-route', label: 'Automations' },
  { href: '/dashboard/autopilot', icon: 'ti-robot', label: 'Autopilot' },
  { href: '/dashboard/campaigns', icon: 'ti-send', label: 'Campaigns' },
  { href: '/dashboard/tasks', icon: 'ti-checklist', label: 'Tasks' },
  { href: '/dashboard/calendar', icon: 'ti-calendar', label: 'Calendar' },
  { href: '/dashboard/forms', icon: 'ti-forms', label: 'Forms' },
  { href: '/dashboard/billing', icon: 'ti-credit-card', label: 'Billing' },
  { href: '/dashboard/settings', icon: 'ti-settings', label: 'Settings' },
  { href: '/dashboard/crew', icon: 'ti-cpu', label: 'Crew' },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="side">
      <div className="side-logo">🚀</div>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} title={n.label}
          className={'nav-i' + (path === n.href ? ' active' : '')}>
          <i className={'ti ' + n.icon} />
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <div className="nav-i" title="Sign out" onClick={signOut}>
        <i className="ti ti-logout" />
      </div>
    </div>
  );
}
