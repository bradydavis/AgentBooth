import 'dotenv/config';
import { createServer } from './server';
import { QueueMonitor } from './queue/QueueMonitor';
import { logger } from './utils/logger';
import path from 'path';

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  const { httpServer } = createServer();

  // Start queue monitor — polls Redis every 5s and triggers calls
  const monitor = new QueueMonitor();
  monitor.start();

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
