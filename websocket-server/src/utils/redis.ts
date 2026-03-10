import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

let redisClient: any = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else if (process.env.REDIS_URL) {
  // Only connect to local Redis if explicitly configured
  const client = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null, // Don't retry — fail fast
  });
  client.on('error', () => {}); // Suppress unhandled error events
  redisClient = client;
}
// If neither is configured, redis stays null and QueueMonitor will skip

export const redis = redisClient;
export const isRedisAvailable = () => redisClient !== null;
