import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5000;
const FREE_BOOTH_ID = 'free-booth-1'; // Matches seed data

/**
 * Polls Redis every 5s and triggers call initiation for idle booths with queued agents.
 * Uses distributed locking to prevent duplicate processing across server instances.
 */
export class QueueMonitor {
  private interval: NodeJS.Timeout | null = null;
  private processing = false;

  constructor() {
    // Redis client initialized in utils/redis.ts
  }

  start() {
    this.interval = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    logger.info('Queue monitor started');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll() {
    if (this.processing) return;
    this.processing = true;

    try {
      // For MVP: just check the single shared free booth
      // In production, query Neon for all active booth IDs
      await this.processBoothQueue(FREE_BOOTH_ID);
    } catch (err) {
      logger.error('Queue monitor poll error', err);
    } finally {
      this.processing = false;
    }
  }

  private async processBoothQueue(boothId: string) {
    const lockKey = `booth:${boothId}:lock`;
    const lockVal = `${Date.now()}-${Math.random()}`;

    // Use set with NX option via ioredis or upstash adapter
    // Note: API differs slightly. Using generic set for compatibility or handling specific impl.
    // Upstash: set(key, value, { nx: true, ex: 10 })
    // IORedis: set(key, value, 'NX', 'EX', 10)
    
    let acquired;
    // @ts-ignore
    if (redis.setnx) {
      // IORedis
      // @ts-ignore
      acquired = await redis.set(lockKey, lockVal, 'NX', 'EX', 10);
    } else {
      // Upstash
      // @ts-ignore
      acquired = await redis.set(lockKey, lockVal, { nx: true, ex: 10 });
    }

    if (!acquired || acquired !== 'OK') {
        // IORedis returns 'OK' on success, null on failure. Upstash returns string or null?
        if (acquired !== 'OK' && acquired !== 1 && acquired !== true) return;
    }

    try {
      const status = await redis.hget(`booth:${boothId}:state`, 'status');
      if (status !== 'idle' && status !== null) return;

      const itemStr = await redis.rpop(`booth:${boothId}:queue`) as string | null;
      if (!itemStr) return;

      const item = JSON.parse(itemStr) as {
        callId: string;
        agentId: string;
        phoneNumber: string;
        context: string;
        webhookUrl?: string;
      };

      // Mark booth as occupied
      await redis.hset(`booth:${boothId}:state`, {
        status: 'occupied',
        currentCallId: item.callId,
        currentAgent: item.agentId,
        callStartedAt: Date.now(),
      });

      // Trigger the WebSocket server's own initiate-call endpoint
      const baseUrl = process.env.PUBLIC_URL ?? 'http://localhost:3001';
      // Use internal fetch
      await fetch(`${baseUrl}/api/initiate-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({ ...item, boothId }),
      });

      logger.info(`Triggered call ${item.callId} for booth ${boothId}`);
    } catch (e) {
        logger.error('Error processing queue item', e);
    } finally {
      const current = await redis.get(lockKey);
      if (current === lockVal) await redis.del(lockKey);
    }
  }
}
