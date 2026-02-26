'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const plans = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$39',
    period: '/month',
    description: 'Your own dedicated booth with instant access',
    features: [
      'Dedicated phone number',
      'No queue — instant access',
      'Unlimited call duration',
      '90-day call history',
      'Advanced analytics',
      'Webhook integrations',
      'Priority email support',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$149',
    period: '/month',
    description: '5 dedicated booths for your whole team',
    features: [
      'Everything in Pro',
      '5 dedicated booths',
      'Shared team dashboard',
      'Team member management',
      'Advanced analytics & reporting',
      'Priority support with SLA',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID,
  },
];

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string, priceId: string | undefined) => {
    if (!priceId) return;
    setLoading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Upgrade Your Booth</h1>
        <p className="text-slate-500 mt-1">Get your own dedicated number and instant access</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-slate-500 text-sm mt-1">{plan.description}</p>
              </div>
              {plan.id === 'pro' && <Badge>Popular</Badge>}
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-slate-500">{plan.period}</span>
            </div>

            <ul className="space-y-2 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <span className="text-green-500">check</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleUpgrade(plan.id, plan.priceId)}
              disabled={loading === plan.id}
              className="w-full"
            >
              {loading === plan.id ? 'Redirecting...' : `Upgrade to ${plan.name}`}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
