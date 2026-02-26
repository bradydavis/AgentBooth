import { Redis } from '@upstash/redis';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5000;
const FREE_BOOTH_ID = 'free-booth-1'; // Matches seed data

/**
 * Polls Redis every 5s and triggers call initiation for idle booths with queued agents.
 * Uses distributed locking to prevent duplicate processing across server instances.
 */
export class QueueMonitor {
  private redis: Redis;
  private interval: NodeJS.Timeout | null = null;
  private processing = false;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
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

    const acquired = await this.redis.set(lockKey, lockVal, { nx: true, ex: 10 });
    if (!acquired) return;

    try {
      const status = await this.redis.hget(`booth:${boothId}:state`, 'status');
      if (status !== 'idle' && status !== null) return;

      const itemStr = await this.redis.rpop(`booth:${boothId}:queue`) as string | null;
      if (!itemStr) return;

      const item = JSON.parse(itemStr) as {
        callId: string;
        agentId: string;
        phoneNumber: string;
        context: string;
        webhookUrl?: string;
      };

      // Mark booth as occupied
      await this.redis.hset(`booth:${boothId}:state`, {
        status: 'occupied',
        currentCallId: item.callId,
        currentAgent: item.agentId,
        callStartedAt: Date.now(),
      });

      // Trigger the WebSocket server's own initiate-call endpoint
      const baseUrl = process.env.PUBLIC_URL ?? 'http://localhost:3001';
      await fetch(`${baseUrl}/api/initiate-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({ ...item, boothId }),
      });

      logger.info(`Triggered call ${item.callId} for booth ${boothId}`);
    } finally {
      const current = await this.redis.get(lockKey);
      if (current === lockVal) await this.redis.del(lockKey);
    }
  }
}
