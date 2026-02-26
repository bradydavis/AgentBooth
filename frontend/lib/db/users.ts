import { db } from './index';
import { users, booths } from './schema';
import { eq } from 'drizzle-orm';

export async function createUser(clerkUserId: string, email: string) {
  const [user] = await db.insert(users).values({
    clerkUserId,
    email,
    tier: 'free',
  }).returning();

  // Create free booth for every new user
  await db.insert(booths).values({
    userId: user.id,
    boothType: 'free',
    status: 'active',
    settings: {},
  });

  return user;
}

export async function getUserByClerkId(clerkUserId: string) {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return user ?? null;
}

export async function getUserById(userId: string) {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

export async function updateUserTier(userId: string, tier: 'free' | 'pro' | 'team') {
  const [user] = await db.update(users)
    .set({ tier, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
