import { db } from './index';
import { calls } from './schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export async function createCall(data: {
  boothId: string;
  agentId: string;
  phoneNumber: string;
  metadata?: Record<string, unknown>;
}) {
  const [call] = await db.insert(calls).values({
    ...data,
    status: 'queued',
    metadata: data.metadata ?? {},
  }).returning();
  return call;
}

export async function updateCall(callId: string, data: {
  status?: string;
  twilioCallSid?: string;
  duration?: number;
  cost?: string;
  transcriptUrl?: string;
  recordingUrl?: string;
  startedAt?: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const [call] = await db.update(calls)
    .set(data)
    .where(eq(calls.id, callId))
    .returning();
  return call;
}

export async function getCallHistory(boothId: string, limit = 50, offset = 0) {
  return db.select()
    .from(calls)
    .where(eq(calls.boothId, boothId))
    .orderBy(desc(calls.startedAt))
    .limit(limit)
    .offset(offset);
}

export async function getCallById(callId: string) {
  const [call] = await db.select()
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);
  return call ?? null;
}

export async function getRecentCalls(boothId: string, since: Date) {
  return db.select()
    .from(calls)
    .where(and(eq(calls.boothId, boothId), gte(calls.startedAt, since)))
    .orderBy(desc(calls.startedAt));
}
