import { createAdmin } from '@/lib/supabase-server';
import PublicForm from './PublicForm';

export const dynamic = 'force-dynamic';

export default async function HostedForm({ params }: { params: { id: string } }) {
  const admin = createAdmin();
  const { data: form } = await admin.from('forms').select('id,name,fields,active').eq('id', params.id).single();

  if (!form || !form.active) {
    return <div className="auth-wrap"><div className="auth-box"><div className="auth-logo">Orbit<span>CRM</span></div><p style={{ textAlign: 'center', color: 'var(--text-sec)' }}>This form is not available.</p></div></div>;
  }
  return <PublicForm form={form} />;
}
