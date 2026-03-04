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

  // Debug — test Twilio auth directly from Railway
  app.get('/debug/twilio', async (_req, res) => {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
      const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
      const client = twilio(accountSid, authToken);
      const account = await client.api.accounts(accountSid).fetch();
      res.json({ success: true, name: account.friendlyName, status: account.status });
    } catch (err: any) {
      // Dump raw hex of first/last 2 chars to detect hidden characters
      const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
      const tok = process.env.TWILIO_AUTH_TOKEN ?? '';
      res.json({
        success: false,
        error: err?.message,
        code: err?.code,
        sid_len: sid.length,
        sid_first4_hex: Buffer.from(sid.slice(0, 4)).toString('hex'),
        sid_last4_hex: Buffer.from(sid.slice(-4)).toString('hex'),
        tok_len: tok.length,
        tok_first4_hex: Buffer.from(tok.slice(0, 4)).toString('hex'),
        tok_last4_hex: Buffer.from(tok.slice(-4)).toString('hex'),
      });
    }
  });

  // Debug — check what Twilio env vars Railway loaded (masked)
  app.get('/debug/env', (_req, res) => {
    const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
    const token = process.env.TWILIO_AUTH_TOKEN ?? '';
    const apiSid = process.env.TWILIO_API_KEY_SID ?? '';
    res.json({
      TWILIO_ACCOUNT_SID: sid ? `${sid.slice(0, 6)}...${sid.slice(-4)}` : 'NOT SET',
      TWILIO_AUTH_TOKEN: token ? `${token.slice(0, 4)}...${token.slice(-4)} (len=${token.length})` : 'NOT SET',
      TWILIO_API_KEY_SID: apiSid ? `${apiSid.slice(0, 6)}...` : 'NOT SET',
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER ?? 'NOT SET',
      PUBLIC_URL: process.env.PUBLIC_URL ?? 'NOT SET',
    });
  });

  // TwiML webhook — Twilio calls this to get streaming instructions
  app.post('/twiml/:callId', (req, res) => {
    const { callId } = req.params;
    const publicUrl = (process.env.PUBLIC_URL ?? `https://${req.hostname}`).replace(/\/$/, '');

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
    } catch (err: any) {
      logger.error('Failed to initiate call', err);
      res.status(500).json({
        error: 'Failed to initiate call',
        detail: err?.message ?? String(err),
        code: err?.code,
      });
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
