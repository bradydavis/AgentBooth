# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

PhoneBooth is currently in the **documentation and specification phase** — no source code has been implemented yet. All architecture decisions are documented in `docs/`. Before implementing anything, read:

1. `docs/00-PROJECT-OVERVIEW.md` — Business model and product concept
2. `docs/01-ARCHITECTURE.md` — System design and data flows
3. `docs/11-AGENT-TEAM-BEST-PRACTICES.md` — Agent coordination strategies

## Architecture Overview

PhoneBooth is a **cloud-based phone booth service for AI agents** — agents queue up to make real phone calls through a shared or dedicated phone number.

The system has **7 independent components** assigned to a parallel agent team:

| Component | Tech | Host | Agent Doc |
|---|---|---|---|
| Database | Neon Postgres + Drizzle ORM | Neon | `docs/02-DATABASE-SETUP.md` |
| Frontend | Next.js 14 (App Router), Clerk auth, Tailwind | Vercel | `docs/03-FRONTEND-APP.md` |
| WebSocket Server | Node.js, Twilio media streams | Railway | `docs/04-WEBSOCKET-SERVER.md` |
| Redis Queue | Upstash Redis (pub/sub + FIFO) | Upstash | `docs/05-REDIS-QUEUE.md` |
| MCP Server | MCP SDK, Node.js | Railway | `docs/06-MCP-SERVER.md` |
| Voice Pipeline | Deepgram (STT), ElevenLabs (TTS) | Railway | `docs/07-VOICE-PIPELINE.md` |
| Stripe Billing | Stripe subscriptions + webhooks | Vercel API | `docs/08-STRIPE-BILLING.md` |

## Development Phases

**Phase 1 (parallel):** Agents 1–4 build independently with mock integrations.
**Phase 2 (sequential):** Agent 5 (MCP) requires Redis; Agent 7 (Billing) requires Frontend + Database.
**Phase 3:** Integration testing per `docs/10-INTEGRATION-TESTING.md`.

## Core Data Flow

**Call request:** Agent → MCP tool (`phonebooth_call`) → Redis FIFO queue → WebSocket server → Twilio outbound call

**Audio pipeline:** Twilio (mulaw) → WebSocket → PCM → Deepgram (STT) → transcript → Agent → ElevenLabs (TTS) → PCM → mulaw → Twilio

**Dashboard updates:** Redis pub/sub → Vercel API routes → browser WebSocket → React state

## Expected Commands (once implemented)

Each component will have its own `package.json`. Typical commands per component:

```bash
npm run dev       # Start local development server
npm run build     # Production build
npm run typecheck # TypeScript type checking (tsc --noEmit)
npm run lint      # ESLint
npm run db:push   # Apply Drizzle schema to Neon (database component)
npm run db:studio # Open Drizzle Studio
```

## Environment Variables

Each component needs different secrets. See `docs/09-DEPLOYMENT.md` for the complete list. Key variables:

- **Frontend:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_WEBSOCKET_URL`
- **WebSocket Server:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `CLOUDFLARE_R2_*`
- **MCP Server:** `UPSTASH_REDIS_REST_URL`, `WEBSOCKET_SERVER_URL`, `INTERNAL_API_KEY`

## Agent Team Configuration

`.claude/settings.json` enables experimental agent team features (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). This project is designed for multi-agent development — each agent owns one component and communicates via documented interfaces.
