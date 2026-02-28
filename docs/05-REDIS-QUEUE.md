# AgentBooth - Redis Queue Management

## Agent Assignment
**Agent 4: Queue Management**

## Overview
Implement the Redis-based queue system for managing agent requests, booth state, and real-time pub/sub updates.

## Technology
- **Upstash Redis** (serverless Redis with REST API)
- **ioredis** for Node.js client

## Key Data Structures

```typescript
// Queue System
booth:{boothId}:queue          → List (FIFO queue)
booth:{boothId}:state          → Hash (status, currentCall, etc.)
booth:{boothId}:history        → Sorted Set (recent calls by timestamp)
booth:{boothId}:lock           → String (distributed lock)

// Call Data
call:{callId}                  → Hash (call details)
call:{callId}:transcript       → List (transcript lines)

// Agent Tracking
agent:{agentId}:current_call   → String (active call ID)

// Pub/Sub Channels
booth:{boothId}:updates        → Real-time updates
global:queue                   → Free tier queue updates
```

## Core Implementation

```typescript
// lib/queue/QueueManager.ts
import { Redis } from '@upstash/redis';

export class QueueManager {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  
  async addToQueue(boothId: string, request: {
    callId: string;
    agentId: string;
    phoneNumber: string;
    context: string;
  }) {
    const queueItem = {
      ...request,
      requestedAt: Date.now()
    };
    
    // Add to queue (LPUSH for FIFO with RPOP)
    await this.redis.lpush(`booth:${boothId}:queue`, JSON.stringify(queueItem));
    
    // Increment queue size
    await this.redis.hincrby(`booth:${boothId}:state`, 'queueSize', 1);
    
    // Set agent's current request
    await this.redis.setex(
      `agent:${request.agentId}:current_call`,
      3600,
      request.callId
    );
    
    // Publish update
    await this.publishQueueUpdate(boothId);
    
    // Get position
    const queueLength = await this.redis.llen(`booth:${boothId}:queue`);
    
    return {
      position: queueLength - 1,
      estimatedWait: await this.calculateWaitTime(boothId, queueLength)
    };
  }
  
  async processNextInQueue(boothId: string) {
    // Acquire distributed lock
    const lockKey = `booth:${boothId}:lock`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    const acquired = await this.redis.set(lockKey, lockValue, {
      nx: true,
      ex: 10
    });
    
    if (!acquired) return null;
    
    try {
      // Check booth status
      const status = await this.redis.hget(`booth:${boothId}:state`, 'status');
      if (status !== 'idle') return null;
      
      // Pop next item
      const itemStr = await this.redis.rpop(`booth:${boothId}:queue`);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr as string);
      
      // Update booth state
      await this.redis.hset(`booth:${boothId}:state`, {
        status: 'occupied',
        currentCallId: item.callId,
        currentAgent: item.agentId,
        callStartedAt: Date.now()
      });
      
      await this.redis.hincrby(`booth:${boothId}:state`, 'queueSize', -1);
      
      // Publish updates
      await this.publishBoothUpdate(boothId, 'occupied', item);
      await this.publishQueueUpdate(boothId);
      
      return item;
    } finally {
      // Release lock
      const current = await this.redis.get(lockKey);
      if (current === lockValue) {
        await this.redis.del(lockKey);
      }
    }
  }
  
  async onCallEnd(callId: string, duration: number) {
    const callData = await this.redis.hgetall(`call:${callId}`);
    const boothId = callData.boothId as string;
    
    // Update booth to idle
    await this.redis.hset(`booth:${boothId}:state`, { status: 'idle' });
    await this.redis.hdel(`booth:${boothId}:state`, 
      'currentCallId', 'currentAgent', 'callStartedAt'
    );
    
    // Add to history
    await this.redis.zadd(
      `booth:${boothId}:history`,
      { score: Date.now(), member: JSON.stringify({ callId, duration }) }
    );
    
    // Clear agent tracking
    await this.redis.del(`agent:${callData.agentId}:current_call`);
    
    // Publish idle status
    await this.publishBoothUpdate(boothId, 'idle');
    
    // Process next in queue
    await this.processNextInQueue(boothId);
  }
  
  private async publishBoothUpdate(boothId: string, status: string, data?: any) {
    await this.redis.publish(`booth:${boothId}:updates`, JSON.stringify({
      type: 'booth_status',
      boothId,
      status,
      data,
      timestamp: Date.now()
    }));
  }
  
  private async publishQueueUpdate(boothId: string) {
    const queueItems = await this.redis.lrange(`booth:${boothId}:queue`, 0, -1);
    const queue = queueItems.map(item => JSON.parse(item));
    
    await this.redis.publish(`booth:${boothId}:updates`, JSON.stringify({
      type: 'queue_update',
      boothId,
      queue,
      queueLength: queue.length,
      timestamp: Date.now()
    }));
  }
  
  private async calculateWaitTime(boothId: string, position: number): Promise<number> {
    const recentCalls = await this.redis.zrange(
      `booth:${boothId}:history`,
      -10,
      -1
    );
    
    if (recentCalls.length === 0) return 180; // 3 min default
    
    const durations = recentCalls.map(c => JSON.parse(c).duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    return Math.ceil(avg * position);
  }
}
```

## Background Jobs

```typescript
// lib/queue/QueueMonitor.ts
export class QueueMonitor {
  private queueManager: QueueManager;
  private interval: NodeJS.Timeout | null = null;
  
  start() {
    this.interval = setInterval(async () => {
      await this.checkAllBooths();
    }, 5000); // Every 5 seconds
  }
  
  async checkAllBooths() {
    const booths = await this.getAllBooths();
    
    for (const boothId of booths) {
      await this.queueManager.processNextInQueue(boothId);
    }
  }
  
  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}
```

## Acceptance Criteria

- ✅ Queue operations (add, pop, list)
- ✅ Booth state management
- ✅ Distributed locking for queue processing
- ✅ Pub/sub for real-time updates
- ✅ Background job monitoring queue
- ✅ Stale call cleanup
