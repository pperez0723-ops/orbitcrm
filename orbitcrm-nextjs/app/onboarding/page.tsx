'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function create() {
    if (!name.trim()) { setErr('Enter a workspace name'); return; }
    setErr(''); setBusy(true);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        + '-' + Math.random().toString(36).slice(2, 6);
      // Ensure a profile row exists (id == auth user id).
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, email: user.email }).select();
      }
      // create_workspace RPC (already live + tested) makes the workspace + owner membership.
      const { data: ws, error } = await supabase.rpc('create_workspace', { p_name: name.trim(), p_slug: slug });
      if (error) throw error;
      // seed the default 6-stage pipeline
      const { error: seedErr } = await supabase.rpc('seed_default_pipeline', { p_ws: ws });
      if (seedErr) throw seedErr;
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e.message || 'Failed to create workspace');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">Orbit<span>CRM</span></div>
        <div className="auth-tag">Set up your workspace</div>
        {err && <div className="auth-error">{err}</div>}
        <label className="auth-label">Company / Workspace name</label>
        <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Acme Co" onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button className="auth-btn" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create Workspace →'}
        </button>
      </div>
    </div>
  );
}
