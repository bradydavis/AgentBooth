# AgentBooth - WebSocket Audio Server

## Agent Assignment
**Agent 3: WebSocket Audio Server**

## Overview
Build the Railway-hosted WebSocket server that handles long-lived connections for audio streaming between Twilio, Deepgram, and ElevenLabs.

## Dependencies
- ✅ Upstash Redis (for booth state)
- ⚠️ Needs: Twilio, Deepgram, ElevenLabs credentials
- ⚠️ Needs: Queue Manager to trigger calls

## Technology Stack
- **Node.js 20+** with TypeScript
- **Express** for HTTP endpoints
- **ws** library for WebSocket connections
- **Twilio SDK** for call management
- **@deepgram/sdk** for STT
- **elevenlabs** SDK for TTS

## Project Structure

```
websocket-server/
├── src/
│   ├── index.ts                # Main server entry point
│   ├── server.ts               # Express + WebSocket setup
│   ├── call/
│   │   ├── CallSession.ts      # Manages a single call
│   │   ├── CallOrchestrator.ts # Coordinates audio pipeline
│   │   └── CallManager.ts      # Manages all active calls
│   ├── audio/
│   │   ├── AudioConverter.ts   # mulaw ↔ PCM conversion
│   │   └── AudioBuffer.ts      # Buffer management
│   ├── integrations/
│   │   ├── TwilioHandler.ts    # Twilio WebSocket handling
│   │   ├── DeepgramClient.ts   # STT integration
│   │   └── ElevenLabsClient.ts # TTS integration
│   ├── storage/
│   │   └── R2Client.ts         # Cloudflare R2 uploads
│   └── utils/
│       ├── redis.ts            # Redis client
│       └── logger.ts           # Logging utility
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Core Classes

### CallSession

```typescript
// src/call/CallSession.ts
import { WebSocket } from 'ws';

export class CallSession {
  public readonly callId: string;
  public readonly boothId: string;
  public readonly agentId: string;
  public readonly phoneNumber: string;
  
  // WebSocket connections
  public twilioWs: WebSocket | null = null;
  public deepgramWs: WebSocket | null = null;
  
  // State
  public isAgentSpeaking: boolean = false;
  public callStartTime: number;
  public transcript: Array<{ speaker: string; text: string; timestamp: number }> = [];
  
  constructor(data: {
    callId: string;
    boothId: string;
    agentId: string;
    phoneNumber: string;
  }) {
    this.callId = data.callId;
    this.boothId = data.boothId;
    this.agentId = data.agentId;
    this.phoneNumber = data.phoneNumber;
    this.callStartTime = Date.now();
  }
  
  addTranscript(speaker: 'caller' | 'agent', text: string) {
    this.transcript.push({
      speaker,
      text,
      timestamp: Date.now()
    });
  }
  
  getDuration(): number {
    return Math.floor((Date.now() - this.callStartTime) / 1000);
  }
}
```

### CallOrchestrator

```typescript
// src/call/CallOrchestrator.ts
import { CallSession } from './CallSession';
import { DeepgramClient } from '../integrations/DeepgramClient';
import { ElevenLabsClient } from '../integrations/ElevenLabsClient';
import { AudioConverter } from '../audio/AudioConverter';
import { redis } from '../utils/redis';

export class CallOrchestrator {
  private deepgram: DeepgramClient;
  private elevenlabs: ElevenLabsClient;
  
  constructor() {
    this.deepgram = new DeepgramClient();
    this.elevenlabs = new ElevenLabsClient();
  }
  
  async setupCall(session: CallSession) {
    // Setup Deepgram connection
    session.deepgramWs = await this.deepgram.connect({
      onTranscript: (transcript, isFinal) => {
        this.handleTranscript(session, transcript, isFinal);
      },
      onError: (error) => {
        console.error('Deepgram error:', error);
      }
    });
  }
  
  async handleTranscript(
    session: CallSession,
    transcript: string,
    isFinal: boolean
  ) {
    if (!isFinal || !transcript.trim()) return;
    
    // Add to transcript
    session.addTranscript('caller', transcript);
    
    // Publish to Redis for dashboard
    await redis.publish(`booth:${session.boothId}:updates`, JSON.stringify({
      type: 'transcript',
      callId: session.callId,
      text: transcript,
      speaker: 'caller',
      timestamp: Date.now()
    }));
    
    // Get agent response (webhook or direct)
    const agentResponse = await this.getAgentResponse(session, transcript);
    
    // Speak response
    await this.speakResponse(session, agentResponse);
  }
  
  async getAgentResponse(session: CallSession, transcript: string): Promise<string> {
    // TODO: Call agent webhook
    // For now, echo response
    return `I heard you say: ${transcript}. How can I help further?`;
  }
  
  async speakResponse(session: CallSession, text: string) {
    session.isAgentSpeaking = true;
    session.addTranscript('agent', text);
    
    // Publish transcript
    await redis.publish(`booth:${session.boothId}:updates`, JSON.stringify({
      type: 'transcript',
      callId: session.callId,
      text: text,
      speaker: 'agent',
      timestamp: Date.now()
    }));
    
    // Get audio from ElevenLabs
    const audioStream = await this.elevenlabs.textToSpeech(text);
    
    // Stream to Twilio
    for await (const chunk of audioStream) {
      if (session.twilioWs?.readyState === 1) {
        const mulawChunk = AudioConverter.pcmToMulaw(chunk);
        session.twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid: session.callId,
          media: {
            payload: mulawChunk.toString('base64')
          }
        }));
      }
    }
    
    session.isAgentSpeaking = false;
  }
  
  async handleTwilioMedia(session: CallSession, payload: string) {
    if (session.isAgentSpeaking) return; // Don't process while agent talks
    
    // Decode and convert
    const mulawAudio = Buffer.from(payload, 'base64');
    const pcmAudio = AudioConverter.mulawToPCM(mulawAudio);
    
    // Send to Deepgram
    if (session.deepgramWs?.readyState === 1) {
      session.deepgramWs.send(pcmAudio);
    }
  }
  
  async endCall(session: CallSession) {
    // Close connections
    session.deepgramWs?.close();
    session.twilioWs?.close();
    
    // Save transcript to R2
    // Save to database
    // Update Redis booth state
  }
}
```

### TwilioHandler

```typescript
// src/integrations/TwilioHandler.ts
import { WebSocket, WebSocketServer } from 'ws';
import { CallSession } from '../call/CallSession';
import { CallOrchestrator } from '../call/CallOrchestrator';

export class TwilioHandler {
  private wss: WebSocketServer;
  private orchestrator: CallOrchestrator;
  private activeCalls: Map<string, CallSession> = new Map();
  
  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.orchestrator = new CallOrchestrator();
  }
  
  setupHandlers() {
    this.wss.on('connection', (ws, request) => {
      const callId = this.extractCallId(request.url);
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        await this.handleMessage(callId, ws, message);
      });
      
      ws.on('close', () => {
        this.handleDisconnect(callId);
      });
    });
  }
  
  async handleMessage(callId: string, ws: WebSocket, message: any) {
    switch (message.event) {
      case 'connected':
        console.log('Twilio connected:', callId);
        break;
        
      case 'start':
        await this.handleStart(callId, ws, message.start);
        break;
        
      case 'media':
        await this.handleMedia(callId, message.media);
        break;
        
      case 'stop':
        await this.handleStop(callId);
        break;
    }
  }
  
  async handleStart(callId: string, ws: WebSocket, startData: any) {
    const session = this.activeCalls.get(callId);
    if (!session) return;
    
    session.twilioWs = ws;
    await this.orchestrator.setupCall(session);
  }
  
  async handleMedia(callId: string, media: any) {
    const session = this.activeCalls.get(callId);
    if (!session) return;
    
    await this.orchestrator.handleTwilioMedia(session, media.payload);
  }
  
  async handleStop(callId: string) {
    const session = this.activeCalls.get(callId);
    if (!session) return;
    
    await this.orchestrator.endCall(session);
    this.activeCalls.delete(callId);
  }
  
  private extractCallId(url: string): string {
    return url.split('/').pop() || '';
  }
  
  private handleDisconnect(callId: string) {
    console.log('Twilio disconnected:', callId);
  }
}
```

## Audio Format Conversion

```typescript
// src/audio/AudioConverter.ts
export class AudioConverter {
  // mulaw to PCM (linear16)
  static mulawToPCM(mulawData: Buffer): Buffer {
    const pcm = Buffer.alloc(mulawData.length * 2);
    
    for (let i = 0; i < mulawData.length; i++) {
      const mulaw = mulawData[i];
      const sign = (mulaw & 0x80) >> 7;
      const exponent = (mulaw & 0x70) >> 4;
      const mantissa = mulaw & 0x0F;
      
      let sample = ((mantissa << 3) + 0x84) << exponent;
      if (sign === 0) sample = -sample;
      
      pcm.writeInt16LE(sample, i * 2);
    }
    
    return pcm;
  }
  
  // PCM to mulaw
  static pcmToMulaw(pcmData: Buffer): Buffer {
    const mulaw = Buffer.alloc(pcmData.length / 2);
    
    for (let i = 0; i < mulaw.length; i++) {
      const sample = pcmData.readInt16LE(i * 2);
      const sign = sample < 0 ? 0x80 : 0x00;
      let magnitude = Math.abs(sample);
      
      magnitude = Math.min(magnitude, 0x7FFF);
      magnitude += 0x84;
      
      let exponent = 7;
      for (let exp = 0; exp < 8; exp++) {
        if (magnitude <= (0x84 << exp)) {
          exponent = exp;
          break;
        }
      }
      
      const mantissa = (magnitude >> (exponent + 3)) & 0x0F;
      mulaw[i] = ~(sign | (exponent << 4) | mantissa);
    }
    
    return mulaw;
  }
}
```

## Server Setup

```typescript
// src/server.ts
import express from 'express';
import { WebSocketServer } from 'ws';
import { TwilioHandler } from './integrations/TwilioHandler';
import twilio from 'twilio';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TwiML webhook endpoint
app.post('/twiml/:callId', (req, res) => {
  const { callId } = req.params;
  const response = new twilio.twiml.VoiceResponse();
  
  const connect = response.connect();
  connect.stream({
    url: `wss://${req.hostname}/media/${callId}`
  });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ server, path: '/media' });
const twilioHandler = new TwilioHandler(wss);
twilioHandler.setupHandlers();
```

## Deployment (Railway)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

```json
// package.json
{
  "name": "agentbooth-websocket",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "twilio": "^4.19.0",
    "@deepgram/sdk": "^3.0.0",
    "elevenlabs-node": "^1.0.0",
    "@upstash/redis": "^1.25.0"
  }
}
```

## Acceptance Criteria

- ✅ WebSocket server running on Railway
- ✅ Twilio Media Streams integration working
- ✅ Deepgram real-time transcription
- ✅ ElevenLabs text-to-speech
- ✅ Audio format conversion (mulaw ↔ PCM)
- ✅ End-to-end latency < 2 seconds
- ✅ Graceful error handling
- ✅ Connection recovery

## Environment Variables

```env
PORT=3001
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CLOUDFLARE_R2_ENDPOINT=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
```

## Testing

```bash
# Local development
npm run dev

# Test Twilio webhook
curl -X POST http://localhost:3001/twiml/test-call-123

# Monitor logs
railway logs
```
