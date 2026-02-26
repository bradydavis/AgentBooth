# PhoneBooth - System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER / AI AGENT                             │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ├──── Browser (Dashboard) ─────────────────────┐
            │                                               │
            │                                               ▼
            │                                  ┌─────────────────────────┐
            │                                  │   Vercel (Next.js)      │
            │                                  │   ┌─────────────────┐   │
            │                                  │   │  Frontend       │   │
            │                                  │   │  - Dashboard    │   │
            │                                  │   │  - Auth pages   │   │
            │                                  │   └─────────────────┘   │
            │                                  │   ┌─────────────────┐   │
            │                                  │   │  API Routes     │   │
            │                                  │   │  - /api/calls   │   │
            │                                  │   │  - /api/booths  │   │
            │                                  │   │  - /api/stripe  │   │
            │                                  │   └─────────────────┘   │
            │                                  │   ┌─────────────────┐   │
            │                                  │   │  WebSocket Proxy│   │
            │                                  │   │  - Real-time    │   │
            │                                  │   │    updates      │   │
            │                                  │   └─────────────────┘   │
            │                                  └──────────┬──────────────┘
            │                                             │
            │                                             ├─── Clerk (Auth)
            │                                             │
            │                                             ├─── Neon (Postgres)
            │                                             │
            │                                             ├─── Stripe (Payments)
            │                                             │
            └──── MCP Client ─────────┐                  │
                                      │                  │
                                      ▼                  │
                            ┌─────────────────────────────┴────┐
                            │   MCP Server (Railway)            │
                            │   ┌───────────────────────────┐   │
                            │   │  Tool: phonebooth_call    │   │
                            │   │  - Validate requests      │   │
                            │   │  - Queue management       │   │
                            │   └───────────────────────────┘   │
                            └────────────────┬──────────────────┘
                                             │
                                             ▼
                            ┌─────────────────────────────────┐
                            │  Queue Manager (Upstash Redis)  │
                            │  ┌──────────────────────────┐   │
                            │  │  booth:*:queue (Lists)   │   │
                            │  │  booth:*:state (Hashes)  │   │
                            │  │  pub/sub channels        │   │
                            │  └──────────────────────────┘   │
                            └────────────────┬────────────────┘
                                             │
                                             ▼
                            ┌─────────────────────────────────┐
                            │  WebSocket Server (Railway)     │
                            │  ┌──────────────────────────┐   │
                            │  │  Call Orchestrator       │   │
                            │  │  - Manage connections    │   │
                            │  │  - Audio streaming       │   │
                            │  │  - Format conversion     │   │
                            │  └──────────────────────────┘   │
                            └───┬───────────┬───────────┬─────┘
                                │           │           │
                ┌───────────────┘           │           └──────────────┐
                │                           │                          │
                ▼                           ▼                          ▼
    ┌────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
    │   Twilio           │   │   Deepgram           │   │   ElevenLabs        │
    │   - Phone numbers  │   │   - Real-time STT    │   │   - Natural TTS     │
    │   - Call routing   │   │   - WebSocket stream │   │   - Voice synthesis │
    │   - Media streams  │   │   - Transcription    │   │   - Low latency     │
    └────────┬───────────┘   └──────────────────────┘   └─────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │  Phone Network     │
    │  (PSTN/VoIP)       │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │  End User          │
    │  (Receives call)   │
    └────────────────────┘
```

## Component Details

### 1. Frontend (Vercel + Next.js)

**Technology**: Next.js 14 with App Router, React Server Components, Tailwind CSS

**Responsibilities**:
- Render user dashboard with booth status
- Display real-time queue visualization
- Show live call transcripts
- Manage user authentication (via Clerk)
- Handle subscription management (via Stripe)
- Provide call history and analytics views

**Does NOT**:
- Handle audio streaming (that's WebSocket server)
- Manage queues directly (that's Redis)
- Store files (that's R2)

**Key Pages**:
- `/` - Landing page
- `/dashboard` - Main booth dashboard
- `/dashboard/history` - Call history
- `/dashboard/settings` - Booth configuration
- `/api/calls` - Call history API
- `/api/booths` - Booth management API
- `/api/stripe/webhook` - Stripe event handling

### 2. WebSocket Server (Railway)

**Technology**: Node.js with WebSocket library, Express for HTTP endpoints

**Responsibilities**:
- Maintain long-lived WebSocket connections with Twilio
- Orchestrate audio pipeline (Twilio ↔ Deepgram ↔ ElevenLabs)
- Convert audio formats (mulaw ↔ PCM)
- Detect speech/silence for interruption handling
- Manage call lifecycle (start, active, end)
- Upload recordings to Cloudflare R2
- Send real-time updates via Redis pub/sub

**Does NOT**:
- Serve frontend UI
- Handle user authentication
- Manage user data or billing
- Implement MCP protocol

**Critical Performance Requirements**:
- Latency < 2 seconds end-to-end
- Handle 10+ concurrent calls
- Graceful error recovery
- Audio buffer management to prevent glitches

### 3. MCP Server (Railway)

**Technology**: Node.js with MCP SDK

**Responsibilities**:
- Expose MCP protocol tools to AI agents
- Validate agent requests (phone number format, permissions)
- Interface with Redis queue system
- Provide call status to agents
- Handle agent callbacks for transcripts
- Rate limiting per agent/user

**Does NOT**:
- Handle actual phone calls
- Process audio
- Manage UI

**MCP Tools Exposed**:
- `phonebooth_call` - Initiate a call
- `phonebooth_status` - Check call/queue status
- `phonebooth_cancel` - Remove from queue

### 4. Upstash Redis (Queue & State Management)

**Technology**: Serverless Redis with REST API

**Responsibilities**:
- Store call queues (Redis Lists - FIFO)
- Store booth state (Redis Hashes)
- Pub/sub for real-time dashboard updates
- Temporary data with TTLs
- Distributed locks for queue processing

**Does NOT**:
- Store long-term data (use Neon)
- Store files (use R2)

**Key Data Structures**:
```
booth:{boothId}:queue          → List (queue of agents)
booth:{boothId}:state          → Hash (current status)
booth:{boothId}:history        → Sorted Set (recent calls)
call:{callId}                  → Hash (call details)
agent:{agentId}:current_call   → String (active call ID)
```

**Pub/sub Channels**:
```
booth:{boothId}:updates        → Booth-specific updates
global:queue                   → Free tier queue updates
```

### 5. Neon Postgres (Persistent Storage)

**Technology**: Serverless Postgres

**Responsibilities**:
- User accounts (linked to Clerk)
- Booth configurations
- Call history (long-term, >7 days)
- Billing records and credits
- Analytics data

**Does NOT**:
- Store real-time state (use Redis)
- Store audio files (use R2)

**Key Tables**:
```sql
users (id, clerk_user_id, email, tier, created_at, updated_at)
booths (id, user_id, twilio_number, tier, status, settings, created_at)
calls (id, booth_id, agent_id, phone_number, duration, cost, 
       transcript_url, recording_url, status, started_at, ended_at)
credits (id, user_id, amount, type, description, created_at)
subscriptions (id, user_id, stripe_subscription_id, status, plan_id)
```

## Data Flow: Making a Call (Detailed)

### Step 1: Agent Request via MCP

```
AI Agent → MCP Client → MCP Server
──────────────────────────────────
Tool: phonebooth_call
Input:
{
  "phone_number": "+1234567890",
  "context": "Schedule a dentist appointment for next week",
  "max_duration": 300
}

MCP Server validates:
- Phone number format (E.164)
- User permissions (authenticated via API key)
- Rate limits (5 requests/min per agent)
```

### Step 2: Queue Management

```
MCP Server → Upstash Redis
──────────────────────────
1. Check user's booth type:
   GET user:{userId}:booths
   
2. Determine booth (free vs dedicated):
   IF user has dedicated booth:
     boothId = booth:{userId}
   ELSE:
     boothId = "free-booth-1"

3. Add to queue (atomic):
   LPUSH booth:{boothId}:queue {
     callId: "call-123",
     agentId: "agent-456",
     phoneNumber: "+1234567890",
     context: "...",
     requestedAt: timestamp
   }
   
4. Update booth state:
   HINCRBY booth:{boothId}:state queueSize 1
   
5. Publish queue update:
   PUBLISH booth:{boothId}:updates {
     type: "queue_update",
     queue: [...]
   }

Response to agent:
{
  "call_id": "call-123",
  "booth_id": "free-booth-1",
  "status": "queued",
  "queue_position": 2,
  "estimated_wait": 180  // seconds
}
```

### Step 3: Queue Processing (Background Job)

```
Queue Monitor (runs every 5 seconds)
────────────────────────────────────
FOR EACH booth:
  1. Try to acquire distributed lock:
     SET booth:{boothId}:lock {timestamp} NX EX 10
     
  2. If lock acquired:
     a. Check booth status:
        GET booth:{boothId}:state.status
        
     b. If status == "idle":
        - RPOP booth:{boothId}:queue → next agent
        - If agent found:
          * Update booth state to "occupied"
          * Store current call ID
          * Trigger WebSocket Server to initiate call
          
  3. Release lock:
     DEL booth:{boothId}:lock
```

### Step 4: Call Initiation (WebSocket Server)

```
WebSocket Server receives trigger from Queue Manager
──────────────────────────────────────────────────
1. Create Twilio call:
   POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls
   {
     "To": "+1234567890",
     "From": "{booth_twilio_number}",
     "Url": "https://phonebooth-ws.railway.app/twiml/{callId}"
   }

2. Twilio calls our webhook URL:
   GET /twiml/{callId}
   
3. We respond with TwiML:
   <Response>
     <Connect>
       <Stream url="wss://phonebooth-ws.railway.app/media/{callId}" />
     </Connect>
   </Response>

4. Twilio opens WebSocket connection to us
5. We open WebSocket connections to Deepgram and ElevenLabs
```

### Step 5: Audio Streaming Loop

```
┌─────────────────────────────────────────────────────────┐
│  INBOUND: User Speaking                                  │
└─────────────────────────────────────────────────────────┘

Twilio → WebSocket Server
Message:
{
  "event": "media",
  "media": {
    "payload": "bm8rSmpvYUp..." // base64 mulaw audio
  }
}

WebSocket Server:
1. Decode base64 → raw mulaw bytes
2. Convert mulaw → PCM (linear16)
3. Check if agent is speaking (isAgentSpeaking flag)
4. If NOT speaking → forward to Deepgram

Deepgram WebSocket:
1. Receive PCM audio chunks
2. Stream back transcripts:
   - Partial results (interim_results: true)
   - Final results (is_final: true)

WebSocket Server receives transcript:
{
  "channel": {
    "alternatives": [{
      "transcript": "Hello, I'd like to schedule an appointment"
    }]
  },
  "is_final": true
}

WebSocket Server:
1. Store transcript chunk in Redis
2. Publish to dashboard (pub/sub)
3. Forward to Agent via webhook or WebSocket

┌─────────────────────────────────────────────────────────┐
│  AGENT PROCESSING                                        │
└─────────────────────────────────────────────────────────┘

Agent receives transcript via callback:
POST {agent_webhook_url}
{
  "call_id": "call-123",
  "transcript": "Hello, I'd like to schedule an appointment",
  "conversation_history": [...],
  "context": "Schedule a dentist appointment"
}

Agent processes and responds:
{
  "response_text": "I'd be happy to help you schedule an appointment. What day works best for you?"
}

┌─────────────────────────────────────────────────────────┐
│  OUTBOUND: Agent Speaking                                │
└─────────────────────────────────────────────────────────┘

WebSocket Server:
1. Set isAgentSpeaking = true
2. Send text to ElevenLabs WebSocket

ElevenLabs:
1. Convert text → audio (streaming)
2. Stream back PCM audio chunks:
   {
     "audio": "base64_pcm_audio",
     "isFinal": false
   }

WebSocket Server:
1. Receive PCM audio chunks
2. Convert PCM → mulaw
3. Encode to base64
4. Stream to Twilio WebSocket:
   {
     "event": "media",
     "streamSid": "MZ...",
     "media": {
       "payload": "base64_mulaw_audio"
     }
   }

Twilio → Phone → User hears agent response

When ElevenLabs signals complete:
{
  "isFinal": true
}

WebSocket Server:
Set isAgentSpeaking = false → resume listening
```

### Step 6: Real-time Dashboard Updates

```
WebSocket Server → Redis Pub/Sub
─────────────────────────────────
Throughout call, publish updates:

PUBLISH booth:{boothId}:updates {
  "type": "transcript",
  "call_id": "call-123",
  "text": "Hello, I'd like to schedule...",
  "speaker": "caller",
  "timestamp": 1709000000000
}

PUBLISH booth:{boothId}:updates {
  "type": "transcript",
  "call_id": "call-123",
  "text": "I'd be happy to help...",
  "speaker": "agent",
  "timestamp": 1709000002000
}

Frontend WebSocket Connection:
──────────────────────────────
User's browser maintains WebSocket to Vercel API route:
ws://localhost:3000/api/ws

Vercel API route subscribes to Redis channels:
- Subscribe to booth:{user's_booth_id}:updates
- Subscribe to global:queue (if free tier)

Forward messages to browser WebSocket:
Browser receives → Updates React state → UI updates
```

### Step 7: Call Completion

```
Call ends (user hangs up or timeout):
──────────────────────────────────────

1. Twilio WebSocket:
   {
     "event": "stop",
     "streamSid": "MZ..."
   }

2. WebSocket Server:
   a. Close all WebSocket connections
   b. Calculate call duration
   c. Save full transcript to Cloudflare R2:
      PUT /recordings/call-123-transcript.json
      
   d. If recording enabled, save audio to R2:
      PUT /recordings/call-123-recording.mp3
      
   e. Update Neon database:
      INSERT INTO calls (
        id, booth_id, agent_id, phone_number,
        duration, cost, transcript_url, recording_url,
        status, started_at, ended_at
      )
      
   f. Update Redis:
      - HSET booth:{boothId}:state status "idle"
      - HDEL booth:{boothId}:state currentCallId
      - ZADD booth:{boothId}:history {timestamp} {call_data}
      - DEL agent:{agentId}:current_call
      
   g. Publish booth is idle:
      PUBLISH booth:{boothId}:updates {
        "type": "booth_status",
        "status": "idle"
      }

3. Queue Manager (triggered by idle status):
   - Process next agent in queue (Step 3)
   - Repeat cycle
```

## API Contracts

### MCP Server → WebSocket Server

```typescript
POST /api/initiate-call
Headers:
  Authorization: Bearer {internal_api_key}
Body:
{
  callId: string;          // Unique call identifier
  boothId: string;         // Which booth to use
  agentId: string;         // Agent making the call
  phoneNumber: string;     // E.164 format: +1234567890
  context: string;         // What agent wants to accomplish
  webhookUrl?: string;     // Callback URL for transcripts
}

Response:
{
  success: boolean;
  streamUrl: string;       // WebSocket URL for this call
  twilioCallSid?: string;  // Twilio's call ID
  error?: string;
}
```

### Agent Webhook (WebSocket Server → Agent)

```typescript
POST {agent_webhook_url}
Headers:
  Content-Type: application/json
  X-PhoneBooth-Signature: {hmac_signature}
Body:
{
  call_id: string;
  transcript: string;      // What the caller just said
  is_final: boolean;       // Is this the complete utterance?
  speaker: 'caller' | 'agent';
  timestamp: number;
  conversation_history: Array<{
    speaker: 'caller' | 'agent';
    text: string;
    timestamp: number;
  }>;
  context: string;         // Original context from request
}

Expected Response (within 5 seconds):
{
  response_text: string;   // What agent wants to say
  end_call?: boolean;      // Optional: end the call
}
```

### Frontend API Routes

```typescript
// Get user's booths
GET /api/booths
Headers:
  Authorization: Bearer {clerk_session_token}
Response:
{
  booths: Array<{
    id: string;
    type: 'free' | 'dedicated';
    twilioNumber?: string;
    status: 'idle' | 'occupied';
    queueLength: number;
    stats: {
      totalCalls: number;
      avgDuration: number;
      avgWaitTime: number;
    };
  }>;
}

// Get call history
GET /api/calls?boothId={boothId}&limit=50&offset=0
Response:
{
  calls: Array<{
    id: string;
    agentId: string;
    phoneNumber: string;
    duration: number;
    cost: number;
    transcriptUrl: string;
    recordingUrl: string;
    startedAt: string;
    endedAt: string;
  }>;
  total: number;
}
```

## Security Architecture

### Authentication Flow

```
User → Clerk → Frontend → API Routes
──────────────────────────────────────
1. User signs in via Clerk UI
2. Clerk returns session token
3. Frontend includes token in API requests
4. API routes validate with Clerk SDK
5. Extract user ID from token
6. Query Neon for user permissions
```

### Service-to-Service Authentication

```
MCP Server → WebSocket Server
──────────────────────────────
Use shared secret (internal API key)
Header: Authorization: Bearer {INTERNAL_API_KEY}

WebSocket Server → Agent Webhook
─────────────────────────────────
HMAC signature in header
X-PhoneBooth-Signature: sha256=...
Agent verifies signature using shared secret
```

### Twilio Webhook Security

```
Twilio → WebSocket Server
─────────────────────────
Validate X-Twilio-Signature header
Use Twilio's validation SDK:
const isValid = twilio.validateRequest(
  authToken,
  signature,
  url,
  params
);
```

## Scaling Considerations

### Current Architecture Limits
- Single WebSocket server: ~10-20 concurrent calls
- Redis queue: Handles thousands of agents
- Neon Postgres: Auto-scales
- Vercel: Auto-scales

### Scaling Plan

**Phase 1: Vertical Scaling (0-100 users)**
- Larger Railway instance
- Single WebSocket server is fine

**Phase 2: Horizontal Scaling (100-1000 users)**
- Multiple WebSocket servers behind load balancer
- Redis pub/sub for coordination
- Sticky sessions based on callId

**Phase 3: Regional Distribution (1000+ users)**
- Deploy WebSocket servers in multiple regions
- Route calls to nearest server
- Global Redis cluster

## Error Handling & Monitoring

### Critical Errors to Monitor

1. **WebSocket disconnections** → Auto-reconnect with exponential backoff
2. **Twilio API failures** → Retry with different number or alert
3. **Deepgram/ElevenLabs failures** → Fallback to text-only mode
4. **Queue processing stuck** → Stale call cleanup job
5. **Redis connection loss** → Circuit breaker pattern

### Monitoring Stack

- **Sentry**: Frontend and backend errors
- **Axiom**: Structured logs from all services
- **Twilio Insights**: Call quality metrics
- **Upstash Metrics**: Redis performance
- **Vercel Analytics**: Frontend performance

### Health Checks

```
GET /health (all services)
Response:
{
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    redis: 'up',
    postgres: 'up',
    twilio: 'up',
    deepgram: 'up',
    elevenlabs: 'up'
  },
  uptime: 123456
}
```

## Next Steps

Once you understand this architecture:
1. Read your assigned component documentation
2. Check dependencies on other components
3. Start with component setup and basic structure
4. Implement core logic
5. Add error handling
6. Write tests
7. Document for integration
