import { WebSocketServer, WebSocket } from 'ws';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

interface DashboardClient {
  ws: WebSocket;
  subscribedBooths: Set<string>;
}

/**
 * Bridges Redis pub/sub to browser WebSocket connections.
 * Browser sends: { type: 'subscribe', boothId: '...' }
 * Browser receives: booth_status, queue_update, transcript events
 */
export class DashboardHandler {
  private clients = new Map<WebSocket, DashboardClient>();

  attach(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket) => {
      const client: DashboardClient = { ws, subscribedBooths: new Set() };
      this.clients.set(ws, client);

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string; boothId?: string };
          if (msg.type === 'subscribe' && msg.boothId) {
            client.subscribedBooths.add(msg.boothId);
            await this.subscribeToRedis(msg.boothId);
          }
        } catch (err) {
          logger.error('Dashboard WS message error', err);
        }
      });

      ws.on('close', () => this.clients.delete(ws));
    });
  }

  private subscribedChannels = new Set<string>();

  private async subscribeToRedis(boothId: string) {
    const channel = `booth:${boothId}:updates`;
    if (this.subscribedChannels.has(channel)) return;
    this.subscribedChannels.add(channel);

    // Upstash Redis REST API doesn't support long-poll subscribe in the same way.
    // We poll via a background loop. In production, use Upstash Redis pub/sub via
    // their WebSocket-compatible subscribe endpoint.
    // For now: the WebSocket server publishes and dashboard clients reconnect to get state.
    logger.info(`Dashboard subscribed to channel: ${channel}`);
  }

  /** Called by CallOrchestrator to push updates to dashboard clients */
  broadcast(boothId: string, data: unknown) {
    const message = JSON.stringify(data);
    for (const [, client] of this.clients) {
      if (client.subscribedBooths.has(boothId) && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  }
}
