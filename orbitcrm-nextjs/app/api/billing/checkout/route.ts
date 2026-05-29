// app/api/billing/checkout/route.ts — create a Stripe Checkout session.
// Uses the REST API directly (no SDK dependency). Set STRIPE_SECRET_KEY +
// the price IDs in env. Returns a URL the client redirects to.
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  agency: process.env.STRIPE_PRICE_AGENCY,
};

export async function POST(req: NextRequest) {
  const wr = await requireWorkspace();
  if ('error' in wr) return wr.error;
  const { workspaceId: ws, admin } = wr;
  const KEY = process.env.STRIPE_SECRET_KEY;
  if (!KEY) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

  let body: any; try { body = await req.json(); } catch { body = {}; }
  const price = PRICES[body.plan];
  if (!price) return NextResponse.json({ error: 'unknown plan' }, { status: 400 });

  const origin = req.headers.get('origin') || '';
  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${origin}/dashboard/billing?success=1`);
  form.set('cancel_url', `${origin}/dashboard/billing?canceled=1`);
  form.set('client_reference_id', ws);
  form.set('metadata[workspace_id]', ws);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const d = await r.json();
  if (d.error) return NextResponse.json({ error: d.error.message }, { status: 502 });
  return NextResponse.json({ ok: true, url: d.url });
}
