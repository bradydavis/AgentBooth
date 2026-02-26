import { createHash } from 'crypto';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { Redis } from '@upstash/redis';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CACHE_TTL = 300; // 5 minutes

export async function resolveUserAndBooth(
  apiKey: string
): Promise<{ userId: string; boothId: string; tier: string }> {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const cacheKey = `auth:${keyHash}`;

  // Check cache first to avoid DB hit on every tool call
  const cached = await redis.get(cacheKey) as { userId: string; boothId: string; tier: string } | null;
  if (cached) return cached;

  // Query database
  const result = await sql`
    SELECT
      u.id as user_id,
      u.tier,
      ak.expires_at,
      b.id as booth_id
    FROM api_keys ak
    JOIN users u ON u.id = ak.user_id
    LEFT JOIN booths b ON b.user_id = u.id AND b.status = 'active'
    WHERE ak.key_hash = ${keyHash}
    ORDER BY
      CASE WHEN b.booth_type = 'dedicated' THEN 0 ELSE 1 END
    LIMIT 1
  `;

  if (!result[0]) throw new Error('Invalid API key');

  const row = result[0] as {
    user_id: string;
    tier: string;
    expires_at: Date | null;
    booth_id: string;
  };

  if (row.expires_at && row.expires_at < new Date()) {
    throw new Error('API key expired');
  }

  // Update last_used_at asynchronously (fire and forget)
  sql`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`.catch(() => {});

  const auth = { userId: row.user_id, boothId: row.booth_id, tier: row.tier };

  // Cache for 5 minutes
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(auth));

  return auth;
}
