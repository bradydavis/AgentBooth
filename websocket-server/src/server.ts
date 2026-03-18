import express from 'express';
import cors from 'cors';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import { TwilioHandler } from './integrations/TwilioHandler';
import { DashboardHandler } from './integrations/DashboardHandler';
import { CallManager } from './call/CallManager';
import { logger } from './utils/logger';

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const callManager = new CallManager();

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      activeCalls: callManager.activeCallCount(),
      uptime: process.uptime(),
    });
  });

  app.get('/api/debug/sessions', (_req, res) => {
    res.json({
      activeCalls: callManager.activeCallCount(),
      sessions: callManager.getSessionDebugInfo(),
    });
  });

  // TwiML webhook — Twilio calls this to get streaming instructions
  app.post('/twiml/:callId', (req, res) => {
    const { callId } = req.params;
    const publicUrl = (process.env.PUBLIC_URL ?? `https://${req.hostname}`).replace(/\/$/, '');
    const wssUrl = `wss://${publicUrl.replace(/^https?:\/\//, '')}/media/${callId}`;

    logger.info(`TwiML requested for callId: ${callId}, wssUrl: ${wssUrl}`);

    const twimlResponse = new twilio.twiml.VoiceResponse();
    const connect = twimlResponse.connect();
    // both_tracks = bidirectional: Twilio sends caller audio to us AND we can send audio back
    connect.stream({ url: wssUrl, track: 'both_tracks' as any });

    const xml = twimlResponse.toString();
    logger.info(`TwiML response: ${xml}`);
    res.type('text/xml').send(xml);
  });

  // Status callback endpoint (Twilio was getting 404)
  app.post('/api/call-status/:callId', (req, res) => {
    const { callId } = req.params;
    logger.info(`Call status for ${callId}: ${JSON.stringify(req.body)}`);
    res.sendStatus(200);
  });

  // Internal API — MCP server calls this to initiate a call
  app.post('/api/initiate-call', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { callId, boothId, agentId, phoneNumber, context, webhookUrl } = req.body;
    if (!callId || !boothId || !agentId || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const result = await callManager.initiateCall({
        callId,
        boothId,
        agentId,
        phoneNumber,
        context,
        webhookUrl,
      });
      res.json(result);
    } catch (err: any) {
      logger.error('Failed to initiate call', err);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  });

  const httpServer = createHttpServer(app);

  // WebSocket servers — use noServer mode so we can route by path prefix
  const mediaWss = new WebSocketServer({ noServer: true });
  const twilioHandler = new TwilioHandler(callManager);
  twilioHandler.attach(mediaWss);

  const dashboardWss = new WebSocketServer({ noServer: true });
  const dashboardHandler = new DashboardHandler();
  dashboardHandler.attach(dashboardWss);

  // Manually route WebSocket upgrades based on URL prefix
  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (url.startsWith('/media')) {
      mediaWss.handleUpgrade(req, socket, head, (ws) => {
        mediaWss.emit('connection', ws, req);
      });
    } else if (url.startsWith('/dashboard')) {
      dashboardWss.handleUpgrade(req, socket, head, (ws) => {
        dashboardWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  return { httpServer, callManager };
}
