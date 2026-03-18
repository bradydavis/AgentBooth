import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { CallOrchestrator } from '../call/CallOrchestrator';
import { CallManager } from '../call/CallManager';
import { logger } from '../utils/logger';

export class TwilioHandler {
  private orchestrators = new Map<string, CallOrchestrator>();

  constructor(private callManager: CallManager) {}

  attach(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // URL: /media/{callId}
      const callId = req.url?.split('/').pop() ?? '';
      logger.info(`Twilio WebSocket connected for callId: ${callId}`);

      const orchestrator = new CallOrchestrator();
      this.orchestrators.set(callId, orchestrator);

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            event: string;
            start?: { streamSid: string };
            media?: { payload: string };
          };

          const session = this.callManager.getSession(callId);
          if (!session) {
            logger.error(`[FATAL] No session found for callId: ${callId} — possible multi-instance routing issue. Active sessions: ${this.callManager.activeCallCount()}`);
            ws.close();
            return;
          }

          switch (msg.event) {
            case 'connected':
              logger.info(`Twilio stream connected: ${callId}`);
              break;

            case 'start':
              session.twilioWs = ws;
              session.streamSid = msg.start?.streamSid ?? null;
              await orchestrator.setupCall(session);
              logger.info(`Call pipeline ready: ${callId}`);
              break;

            case 'media':
              if (msg.media?.payload) {
                await orchestrator.handleInboundAudio(session, msg.media.payload);
              }
              break;

            case 'stop':
              await this.handleCallEnd(callId);
              break;
          }
        } catch (err) {
          logger.error(`Error handling Twilio message for ${callId}`, err);
        }
      });

      ws.on('close', () => {
        logger.info(`Twilio WebSocket closed: ${callId}`);
        this.handleCallEnd(callId);
      });

      ws.on('error', (err) => logger.error(`Twilio WS error: ${callId}`, err));
    });
  }

  private async handleCallEnd(callId: string) {
    const orchestrator = this.orchestrators.get(callId);
    if (orchestrator) {
      await orchestrator.teardown();
      this.orchestrators.delete(callId);
    }
    this.callManager.removeSession(callId);
  }
}
