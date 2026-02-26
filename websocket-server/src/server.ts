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

  // TwiML webhook — Twilio calls this to get streaming instructions
  app.post('/twiml/:callId', (req, res) => {
    const { callId } = req.params;
    const publicUrl = process.env.PUBLIC_URL ?? `https://${req.hostname}`;

    const twimlResponse = new twilio.twiml.VoiceResponse();
    const connect = twimlResponse.connect();
    connect.stream({ url: `wss://${publicUrl.replace(/^https?:\/\//, '')}/media/${callId}` });

    res.type('text/xml').send(twimlResponse.toString());
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
    } catch (err) {
      logger.error('Failed to initiate call', err);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  });

  const httpServer = createHttpServer(app);

  // WebSocket for Twilio Media Streams
  const mediaWss = new WebSocketServer({ server: httpServer, path: '/media' });
  const twilioHandler = new TwilioHandler(callManager);
  twilioHandler.attach(mediaWss);

  // WebSocket for browser dashboard
  const dashboardWss = new WebSocketServer({ server: httpServer, path: '/dashboard' });
  const dashboardHandler = new DashboardHandler();
  dashboardHandler.attach(dashboardWss);

  return { httpServer, callManager };
}
