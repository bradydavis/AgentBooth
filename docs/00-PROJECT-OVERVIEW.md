# AgentBooth - Project Overview

## Concept
AgentBooth is a cloud-based "phone booth" service for AI agents. Agents queue up to use a shared phone number (freemium) or get their own dedicated booth with a private number (paid tier).

## Core Value Proposition
- **For Free Users**: Share a phone booth, wait in queue, experience the product
- **For Paid Users**: Get your own booth with dedicated number, no waiting
- **For Developers**: Simple MCP integration to give agents phone calling capabilities

## Metaphor
Think of it like a real phone booth - in the free tier, multiple people (AI agents) share one phone booth and have to wait their turn. Paid users get their own private booth with instant access.

## Key Features

### MVP (Version 1.0)
- ✅ Single shared phone booth (1 Twilio number)
- ✅ Real-time queue visualization
- ✅ Live call transcription in dashboard
- ✅ MCP server for agent integration
- ✅ User authentication (Clerk)
- ✅ Basic analytics (calls, duration, queue times)
- ✅ Call recordings stored in cloud
- ✅ Upgrade flow (free → paid tier)

### Post-MVP (Future)
- Multiple shared booths (scale free tier)
- Advanced analytics dashboard
- Call forwarding/transfer
- Custom voice selection per booth
- Webhook integrations
- Team management
- API rate limiting per user

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14 + Tailwind CSS | Modern React framework with server components |
| Auth | Clerk | Drop-in authentication with user management |
| Database | Neon Postgres | Serverless Postgres for user/call data |
| Queue/State | Upstash Redis | Serverless Redis for queues and real-time state |
| Frontend Hosting | Vercel | Next.js optimized hosting platform |
| WebSocket Server | Railway | Long-lived WebSocket connections for audio |
| Telephony | Twilio | Phone numbers, call routing, audio streaming |
| Speech-to-Text | Deepgram | Real-time transcription of phone calls |
| Text-to-Speech | ElevenLabs | Natural voice synthesis for agents |
| File Storage | Cloudflare R2 | Call recordings and transcripts |
| Payments | Stripe | Subscription management and billing |
| Monitoring | Sentry + Axiom | Error tracking and logging |

## User Journeys

### Free Tier User Journey
1. Sign up with email (Clerk handles this)
2. View shared booth dashboard - see the booth status and queue
3. Configure their AI agent with MCP credentials
4. Agent calls `agentbooth_call` MCP tool with phone number
5. Agent is added to queue - see position and estimated wait time
6. When booth becomes free, agent's call starts automatically
7. User sees live transcript in dashboard as call progresses
8. Call ends, recording and transcript available for download
9. Next agent in queue starts automatically

### Paid Tier User Journey
1. User upgrades to Pro tier ($39/mo via Stripe)
2. Dedicated booth is provisioned with new Twilio number
3. User gets their own phone number displayed in dashboard
4. Agent calls `agentbooth_call` MCP tool
5. Call starts immediately - no queue, no waiting
6. Full call history and analytics available
7. Can configure booth settings (max duration, voice, etc.)

## Business Model

### Free Tier (Forever Free)
- ✅ Unlimited agents can use the shared booth
- ✅ Unlimited calls
- ⚠️ 5-minute max duration per call
- ⚠️ Wait in queue when booth is occupied
- ⚠️ Shared phone number (visible to all users)
- ✅ Basic transcripts
- ✅ 7-day call history
- ⚠️ Community support only

### Pro Tier - $39/month per booth
- ✅ Dedicated booth with your own phone number
- ✅ No queue - instant access
- ✅ Unlimited call duration
- ✅ 90-day call history with full transcripts
- ✅ Advanced analytics dashboard
- ✅ Custom voice settings
- ✅ Webhook integrations
- ✅ Priority email support

### Team Tier - $149/month
- ✅ 5 dedicated booths
- ✅ Shared team dashboard
- ✅ Call history across all booths
- ✅ Team member management
- ✅ Advanced analytics and reporting
- ✅ SSO (future)
- ✅ Priority support with SLA

## Success Metrics (KPIs)

### Technical Metrics
- **Call Latency**: < 2 seconds from user speech to agent response
- **Uptime**: 99.5%+ availability
- **Transcript Accuracy**: 90%+ word error rate
- **Queue Wait Time**: < 3 minutes average for free tier

### Business Metrics
- **Free to Paid Conversion**: Target 5-10%
- **Churn Rate**: < 5% monthly
- **Average Calls per User**: Track engagement
- **NPS Score**: Target 40+

## Development Timeline

### Week 1-2: Foundation
- Set up Vercel + Next.js project
- Configure Clerk authentication
- Set up Neon Postgres with initial schema
- Set up Upstash Redis
- Create basic frontend shell

### Week 3-4: Core Audio Pipeline
- Set up Railway WebSocket server
- Integrate Twilio for phone calls
- Integrate Deepgram for STT
- Integrate ElevenLabs for TTS
- Test end-to-end audio streaming

### Week 5: Queue & MCP
- Implement Redis-based queue system
- Build MCP server with agentbooth_call tool
- Test agent integration
- Implement queue processing logic

### Week 6: Frontend & Real-time
- Build dashboard UI with queue visualization
- Implement WebSocket for real-time updates
- Add call history views
- Create booth management UI

### Week 7: Billing & Polish
- Integrate Stripe subscriptions
- Build upgrade flow
- Add error handling and monitoring
- End-to-end testing

### Week 8: Beta Launch
- Deploy to production
- Invite beta users
- Monitor and fix issues
- Gather feedback

## Agent Team Structure

This project is designed to be built by multiple AI agents working in parallel. Each major component has its own documentation file.

### Recommended Agent Assignments

**Agent 1: Database & Backend Setup**
- File: `02-DATABASE-SETUP.md`
- Tasks: Neon Postgres schema, initial migrations, API helpers

**Agent 2: Frontend Application**
- File: `03-FRONTEND-APP.md`
- Tasks: Next.js app, Clerk integration, UI components

**Agent 3: WebSocket Audio Server**
- File: `04-WEBSOCKET-SERVER.md`
- Tasks: Railway server, Twilio/Deepgram/ElevenLabs integration

**Agent 4: Queue Management**
- File: `05-REDIS-QUEUE.md`
- Tasks: Redis queue logic, booth state management, pub/sub

**Agent 5: MCP Server**
- File: `06-MCP-SERVER.md`
- Tasks: MCP protocol implementation, tool definitions

**Agent 6: Voice Pipeline**
- File: `07-VOICE-PIPELINE.md`
- Tasks: Audio format conversions, streaming logic

**Agent 7: Billing Integration**
- File: `08-STRIPE-BILLING.md`
- Tasks: Stripe subscriptions, webhooks, upgrade flow

### Integration Points
After individual components are built, agents will need to coordinate on:
- API contracts between services
- Environment variable management
- Deployment configurations
- End-to-end testing

## Repository Structure

```
agentbooth/
├── docs/                      # Documentation for agent teams
│   ├── 00-PROJECT-OVERVIEW.md
│   ├── 01-ARCHITECTURE.md
│   ├── 02-DATABASE-SETUP.md
│   ├── 03-FRONTEND-APP.md
│   ├── 04-WEBSOCKET-SERVER.md
│   ├── 05-REDIS-QUEUE.md
│   ├── 06-MCP-SERVER.md
│   ├── 07-VOICE-PIPELINE.md
│   ├── 08-STRIPE-BILLING.md
│   ├── 09-DEPLOYMENT.md
│   └── 10-INTEGRATION-TESTING.md
├── frontend/                  # Next.js application
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   ├── lib/                  # Utilities and helpers
│   └── public/               # Static assets
├── websocket-server/          # Railway WebSocket server
│   ├── src/
│   │   ├── audio/            # Audio processing
│   │   ├── twilio/           # Twilio integration
│   │   ├── deepgram/         # STT integration
│   │   └── elevenlabs/       # TTS integration
│   └── package.json
├── mcp-server/                # MCP protocol server
│   ├── src/
│   │   ├── tools/            # MCP tool implementations
│   │   └── queue/            # Queue interface
│   └── package.json
├── shared/                    # Shared types and utilities
│   └── types/                # TypeScript types
└── .env.example              # Example environment variables
```

## Getting Started for Agents

1. **Read this overview** to understand the big picture
2. **Read `01-ARCHITECTURE.md`** to understand how components interact
3. **Pick your component** based on your assignment
4. **Read your component's documentation file**
5. **Check dependencies** - what do you need from other agents?
6. **Start building** following the spec in your doc
7. **Write tests** as you go
8. **Document your work** for the next agent

## Environment Variables Overview

Each component will need different environment variables. The complete list is in `09-DEPLOYMENT.md`, but here's a summary:

**Frontend (Vercel)**
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `DATABASE_URL` (Neon)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RAILWAY_WEBSOCKET_URL`

**WebSocket Server (Railway)**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `CLOUDFLARE_R2_*` (storage credentials)

**MCP Server (Railway)**
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `WEBSOCKET_SERVER_URL`

## Support & Questions

For agents working on this project:
- Reference the architecture document for how components connect
- Check API contracts before making requests to other services
- Mock external dependencies during development
- Write integration tests for your component
- Document any deviations from the spec

## Success Criteria for MVP

The MVP is complete when:
- ✅ A user can sign up and see the shared booth dashboard
- ✅ An AI agent can call `agentbooth_call` and get queued
- ✅ Calls are processed in order (FIFO queue)
- ✅ Users see live transcripts during calls
- ✅ Call recordings are saved and accessible
- ✅ Users can upgrade to Pro and get a dedicated booth
- ✅ Pro users' agents get instant access (no queue)
- ✅ System handles 5+ concurrent agents gracefully
- ✅ All error cases are handled with appropriate user feedback

Let's build this! 🚀
