# AgentBooth - Stripe Billing Integration

## Agent Assignment
**Agent 7: Billing Integration**

## Overview
Implement Stripe subscriptions for Pro and Team tiers, with upgrade flow and webhook handling.

## Stripe Products

### Free Tier
- No Stripe subscription
- Shared booth access
- Queue system

### Pro Tier - $39/month
- Stripe Product ID: `prod_Pro`
- Price ID: `price_ProMonthly`
- Features: 1 dedicated booth

### Team Tier - $149/month
- Stripe Product ID: `prod_Team`
- Price ID: `price_TeamMonthly`
- Features: 5 dedicated booths

## Setup

```bash
npm install stripe
```

```typescript
// lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
```

## Checkout Session Creation

```typescript
// app/api/create-checkout/route.ts
import { stripe } from '@/lib/stripe';
import { auth } from '@clerk/nextjs';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });
  
  const { priceId } = await req.json();
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?canceled=true`,
    metadata: {
      userId,
    },
  });
  
  return Response.json({ url: session.url });
}
```

## Webhook Handler

```typescript
// app/api/stripe/webhook/route.ts
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { createDedicatedBooth } from '@/lib/db/booths';
import { updateUserTier } from '@/lib/db/users';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
  }
  
  return new Response(JSON.stringify({ received: true }));
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;
  
  // Provision dedicated booth
  const twilioNumber = await provisionTwilioNumber();
  await createDedicatedBooth(userId, twilioNumber);
  
  // Update user tier
  await updateUserTier(userId, 'pro');
}
```

## Upgrade Flow Component

```typescript
// app/upgrade/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function UpgradePage() {
  async function handleUpgrade(priceId: string) {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });
    
    const { url } = await res.json();
    window.location.href = url;
  }
  
  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1 className="text-4xl font-bold mb-8">Upgrade Your AgentBooth</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-2">Pro</h2>
          <p className="text-4xl font-bold mb-4">$39<span className="text-lg">/mo</span></p>
          <ul className="space-y-2 mb-6">
            <li>✅ 1 dedicated booth</li>
            <li>✅ Own phone number</li>
            <li>✅ No queue</li>
            <li>✅ Unlimited duration</li>
          </ul>
          <Button 
            onClick={() => handleUpgrade('price_ProMonthly')}
            className="w-full"
          >
            Upgrade to Pro
          </Button>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-2">Team</h2>
          <p className="text-4xl font-bold mb-4">$149<span className="text-lg">/mo</span></p>
          <ul className="space-y-2 mb-6">
            <li>✅ 5 dedicated booths</li>
            <li>✅ Team dashboard</li>
            <li>✅ Advanced analytics</li>
            <li>✅ Priority support</li>
          </ul>
          <Button 
            onClick={() => handleUpgrade('price_TeamMonthly')}
            className="w-full"
          >
            Upgrade to Team
          </Button>
        </Card>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- ✅ Stripe checkout working
- ✅ Webhook handling subscriptions
- ✅ Booth provisioning on upgrade
- ✅ Subscription cancellation handling
- ✅ Customer portal access
