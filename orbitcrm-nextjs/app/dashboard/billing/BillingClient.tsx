'use client';
import { useState } from 'react';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$49', features: ['1,000 contacts', 'Pipeline + Inbox', 'Basic automations'] },
  { id: 'pro', name: 'Pro', price: '$99', features: ['Unlimited contacts', 'AI Autopilot', 'Voice agent', 'All automations'], featured: true },
  { id: 'agency', name: 'Agency', price: '$299', features: ['White-label', 'Unlimited workspaces', 'Priority support', 'Resell rights'] },
];

export default function BillingClient({ sub }: { sub: any }) {
  const [busy, setBusy] = useState('');

  async function checkout(plan: string) {
    setBusy(plan);
    try {
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else alert(d.error || 'Checkout unavailable — Stripe not configured yet.');
    } catch { alert('Checkout failed'); } finally { setBusy(''); }
  }

  return (
    <>
      <div className="top"><div className="top-title">Billing</div></div>
      <div className="content">
        {sub && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13 }}>Current plan: <strong style={{ color: 'var(--teal)' }}>{sub.plan}</strong> · {sub.status}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {PLANS.map((p) => (
            <div key={p.id} className="panel" style={{ flex: 1, minWidth: 220, borderColor: p.featured ? 'var(--red)' : 'var(--border-dim)', position: 'relative' }}>
              {p.featured && <div style={{ position: 'absolute', top: -10, right: 14 }}><span className="tag" style={{ background: 'var(--red)', color: '#fff' }}>Popular</span></div>}
              <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 28, fontFamily: 'Rajdhani', fontWeight: 700, margin: '8px 0' }}>{p.price}<span style={{ fontSize: 13, color: 'var(--text-dim)' }}>/mo</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '14px 0' }}>
                {p.features.map((f) => <div key={f} style={{ fontSize: 12.5, color: 'var(--text-sec)' }}>✓ {f}</div>)}
              </div>
              <button className="btn-save" style={{ width: '100%' }} onClick={() => checkout(p.id)} disabled={busy === p.id}>
                {busy === p.id ? '…' : 'Choose ' + p.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
