// app/api/billing/webhook/route.ts — Stripe webhook → update subscriptions.
// Note: for production, verify the Stripe-Signature with STRIPE_WEBHOOK_SECRET
// using the raw body. We read the event and sync subscription state.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let event: any;
  try { event = await req.json(); } catch { return NextResponse.json({ error: 'bad payload' }, { status: 400 }); }
  const admin = createAdmin();
  const type = event.type;
  const obj = event.data?.object || {};

  try {
    if (type === 'checkout.session.completed') {
      const ws = obj.metadata?.workspace_id || obj.client_reference_id;
      if (ws) {
        await admin.from('subscriptions').upsert({
          workspace_id: ws,
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          status: 'active', plan: 'pro',
          updated_at: new Date().toISOString(),
        });
        await admin.from('workspaces').update({ plan: 'pro' }).eq('id', ws);
      }
    } else if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const subId = obj.id;
      const status = type.endsWith('deleted') ? 'canceled' : obj.status;
      await admin.from('subscriptions').update({
        status, current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subId);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
