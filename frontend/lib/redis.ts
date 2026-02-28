import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

let redisClient: any;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  // Use local Redis
  redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
}

export const redis = redisClient;
