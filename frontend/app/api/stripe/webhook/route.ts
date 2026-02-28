import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSubscription, updateSubscription } from '@/lib/db/subscriptions';
import { updateUserTier } from '@/lib/db/users';
import { createDedicatedBooth } from '@/lib/db/booths';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;

      const sub = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const planId = sub.items.data[0]?.price.nickname?.toLowerCase() ?? 'pro';

      await createSubscription({
        userId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: sub.customer as string,
        planId,
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      });

      await updateUserTier(userId, planId as 'pro' | 'team');

      // Provision dedicated booth — Twilio number must be purchased separately
      // and passed via webhook metadata or admin flow
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await updateSubscription(sub.id, {
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) await updateUserTier(userId, 'free');
      await updateSubscription(sub.id, { status: 'canceled' });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
