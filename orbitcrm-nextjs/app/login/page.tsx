'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit() {
    setErr(''); setOk(''); setBusy(true);
    try {
      if (mode === 'up') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is off, a session exists now → go onboard.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { router.push('/onboarding'); return; }
        setOk('Check your email to confirm, then sign in.');
        setMode('in');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-logo">Orbit<span>CRM</span></div>
        <div className="auth-tag">Mission Control · Sales Intelligence</div>
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        <label className="auth-label">Email</label>
        <input className="auth-input" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <label className="auth-label">Password</label>
        <input className="auth-input" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="auth-btn" onClick={submit} disabled={busy}>
          {busy ? '…' : mode === 'in' ? '🚀 Launch Mission' : 'Create Account'}
        </button>
        <div className="auth-switch">
          {mode === 'in'
            ? <>No account? <b onClick={() => { setMode('up'); setErr(''); }}>Start free trial</b></>
            : <>Have an account? <b onClick={() => { setMode('in'); setErr(''); }}>Sign in</b></>}
        </div>
      </div>
    </div>
  );
}
