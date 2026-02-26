import { db } from './index';
import { apiKeys, users } from './schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `pb_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 10);
  return { key, hash, prefix };
}

export async function createApiKey(userId: string, name: string) {
  const { key, hash, prefix } = generateApiKey();

  await db.insert(apiKeys).values({
    userId,
    keyHash: hash,
    keyPrefix: prefix,
    name,
  });

  // Return the raw key only once — it cannot be retrieved again
  return { key, prefix, name };
}

export async function getUserByApiKeyHash(keyHash: string) {
  const result = await db.select({
    userId: apiKeys.userId,
    keyId: apiKeys.id,
    expiresAt: apiKeys.expiresAt,
  })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!result[0]) return null;
  if (result[0].expiresAt && result[0].expiresAt < new Date()) return null;

  return result[0];
}

export async function updateApiKeyLastUsed(keyHash: string) {
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.keyHash, keyHash));
}

export async function getUserApiKeys(userId: string) {
  return db.select({
    id: apiKeys.id,
    keyPrefix: apiKeys.keyPrefix,
    name: apiKeys.name,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
    expiresAt: apiKeys.expiresAt,
  })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}

export async function deleteApiKey(keyId: string, userId: string) {
  await db.delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
}
