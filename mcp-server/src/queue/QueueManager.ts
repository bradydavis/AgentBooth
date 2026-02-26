import { Redis } from '@upstash/redis';

interface QueueItem {
  callId: string;
  agentId: string;
  phoneNumber: string;
  context: string;
  webhookUrl?: string;
  maxDuration?: number;
  requestedAt: number;
}

export class QueueManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async addToQueue(
    boothId: string,
    request: Omit<QueueItem, 'requestedAt'>
  ): Promise<{ position: number; estimatedWaitSeconds: number }> {
    const item: QueueItem = { ...request, requestedAt: Date.now() };

    await Promise.all([
      this.redis.lpush(`booth:${boothId}:queue`, JSON.stringify(item)),
      this.redis.hincrby(`booth:${boothId}:state`, 'queueSize', 1),
      this.redis.setex(`agent:${request.agentId}:current_call`, 3600, request.callId),
      this.redis.hset(`call:${request.callId}`, {
        callId: request.callId,
        boothId,
        agentId: request.agentId,
        phoneNumber: request.phoneNumber,
        status: 'queued',
        requestedAt: item.requestedAt,
      }),
    ]);

    await this.publishQueueUpdate(boothId);

    const queueLength = await this.redis.llen(`booth:${boothId}:queue`);
    const position = queueLength - 1;
    const estimatedWaitSeconds = await this.estimateWait(boothId, position);

    return { position, estimatedWaitSeconds };
  }

  async removeFromQueue(boothId: string, callId: string): Promise<boolean> {
    const items = (await this.redis.lrange(`booth:${boothId}:queue`, 0, -1)) as string[];
    const target = items.find((i) => {
      try { return JSON.parse(i).callId === callId; } catch { return false; }
    });

    if (!target) return false;

    await this.redis.lrem(`booth:${boothId}:queue`, 1, target);
    await this.redis.hincrby(`booth:${boothId}:state`, 'queueSize', -1);
    await this.redis.del(`call:${callId}`);
    await this.publishQueueUpdate(boothId);

    return true;
  }

  async getAgentStatus(agentId: string, boothId: string): Promise<Record<string, unknown>> {
    const currentCallId = await this.redis.get(`agent:${agentId}:current_call`) as string | null;

    if (!currentCallId) {
      return { status: 'idle', message: 'No active or queued calls' };
    }

    const callData = await this.redis.hgetall(`call:${currentCallId}`) as Record<string, unknown>;
    if (!callData || Object.keys(callData).length === 0) {
      return { status: 'idle', message: 'No active or queued calls' };
    }

    // Get queue position if still queued
    if (callData.status === 'queued') {
      const items = (await this.redis.lrange(`booth:${boothId}:queue`, 0, -1)) as string[];
      const position = items.findIndex((i) => {
        try { return JSON.parse(i).callId === currentCallId; } catch { return false; }
      });
      return {
        ...callData,
        queue_position: position >= 0 ? position : null,
        estimated_wait_seconds: position >= 0 ? await this.estimateWait(boothId, position) : 0,
      };
    }

    return callData;
  }

  private async estimateWait(boothId: string, position: number): Promise<number> {
    const recent = (await this.redis.zrange(`booth:${boothId}:history`, -10, -1)) as string[];
    if (recent.length === 0) return 180 * (position + 1); // 3 min default per position

    const durations = recent
      .map((r) => { try { return (JSON.parse(r) as { duration: number }).duration; } catch { return 0; } })
      .filter((d) => d > 0);

    if (durations.length === 0) return 180 * (position + 1);

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    return Math.ceil(avg * (position + 1));
  }

  private async publishQueueUpdate(boothId: string) {
    const items = (await this.redis.lrange(`booth:${boothId}:queue`, 0, -1)) as string[];
    const queue = items.map((i) => { try { return JSON.parse(i); } catch { return null; } }).filter(Boolean);

    await this.redis.publish(`booth:${boothId}:updates`, JSON.stringify({
      type: 'queue_update',
      boothId,
      queue,
      queueLength: queue.length,
      timestamp: Date.now(),
    }));
  }
}
