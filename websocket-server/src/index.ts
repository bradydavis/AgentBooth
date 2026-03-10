import 'dotenv/config';
import { createServer } from './server';
import { QueueMonitor } from './queue/QueueMonitor';
import { logger } from './utils/logger';
import path from 'path';

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  const { httpServer } = createServer();

  // Start queue monitor only if Redis is configured
  const { isRedisAvailable } = await import('./utils/redis');
  const monitor = new QueueMonitor();
  if (isRedisAvailable()) {
    monitor.start();
    logger.info('Queue monitor started (Redis available)');
  } else {
    logger.warn('Redis not configured — queue monitor disabled. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN or REDIS_URL to enable.');
  }

  httpServer.listen(PORT, () => {
    logger.info(`WebSocket server listening on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    monitor.stop();
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
