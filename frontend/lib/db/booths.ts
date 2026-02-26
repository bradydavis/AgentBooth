import { db } from './index';
import { booths } from './schema';
import { eq } from 'drizzle-orm';

export async function getUserBooths(userId: string) {
  return db.select()
    .from(booths)
    .where(eq(booths.userId, userId));
}

export async function getBoothById(boothId: string) {
  const [booth] = await db.select()
    .from(booths)
    .where(eq(booths.id, boothId))
    .limit(1);
  return booth ?? null;
}

export async function createDedicatedBooth(userId: string, twilioNumber: string) {
  const [booth] = await db.insert(booths).values({
    userId,
    boothType: 'dedicated',
    twilioNumber,
    status: 'active',
    settings: {},
  }).returning();
  return booth;
}

export async function updateBoothStatus(boothId: string, status: 'active' | 'suspended') {
  const [booth] = await db.update(booths)
    .set({ status, updatedAt: new Date() })
    .where(eq(booths.id, boothId))
    .returning();
  return booth;
}

export async function getBoothByTwilioNumber(twilioNumber: string) {
  const [booth] = await db.select()
    .from(booths)
    .where(eq(booths.twilioNumber, twilioNumber))
    .limit(1);
  return booth ?? null;
}
