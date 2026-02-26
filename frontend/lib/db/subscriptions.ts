import { db } from './index';
import { subscriptions } from './schema';
import { eq } from 'drizzle-orm';

export async function createSubscription(data: {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}) {
  const [sub] = await db.insert(subscriptions).values(data).returning();
  return sub;
}

export async function updateSubscription(stripeSubscriptionId: string, data: {
  status?: string;
  planId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}) {
  const [sub] = await db.update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return sub;
}

export async function getUserSubscription(userId: string) {
  const [sub] = await db.select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return sub ?? null;
}
