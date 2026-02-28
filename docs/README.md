# AgentBooth - Agent Team Documentation

## 📋 Complete Documentation Set for Building with Claude Code Agent Teams

This directory contains comprehensive documentation for building AgentBooth, a cloud-based phone booth service for AI agents.

## 📁 Documentation Files

### Core Documentation
1. **00-PROJECT-OVERVIEW.md** - Start here! High-level concept, tech stack, business model
2. **01-ARCHITECTURE.md** - System design, data flows, component interactions
3. **11-AGENT-TEAM-BEST-PRACTICES.md** - How to coordinate multiple agents effectively

### Component-Specific Guides (Assign to Individual Agents)
4. **02-DATABASE-SETUP.md** - Neon Postgres schema and setup (Agent 1)
5. **03-FRONTEND-APP.md** - Next.js + Clerk frontend (Agent 2)
6. **04-WEBSOCKET-SERVER.md** - Railway audio streaming server (Agent 3)
7. **05-REDIS-QUEUE.md** - Upstash queue management (Agent 4)
8. **06-MCP-SERVER.md** - MCP protocol implementation (Agent 5)
9. **07-VOICE-PIPELINE.md** - Twilio + Deepgram + ElevenLabs (Agent 6)
10. **08-STRIPE-BILLING.md** - Payment integration (Agent 7)

### Deployment & Testing
11. **09-DEPLOYMENT.md** - Complete deployment checklist
12. **10-INTEGRATION-TESTING.md** - End-to-end testing scenarios

## 🚀 Quick Start for Agent Teams

### Step 1: Read Foundation Documents
All agents should read:
- 00-PROJECT-OVERVIEW.md (understand the product)
- 01-ARCHITECTURE.md (understand how components connect)
- 11-AGENT-TEAM-BEST-PRACTICES.md (learn coordination strategy)

### Step 2: Assign Components
Assign each agent to a component (02-08):
- **Agent 1** → Database Setup
- **Agent 2** → Frontend App
- **Agent 3** → WebSocket Server
- **Agent 4** → Redis Queue
- **Agent 5** → MCP Server
- **Agent 6** → Voice Pipeline
- **Agent 7** → Stripe Billing

### Step 3: Parallel Development (Week 1-2)
Agents 1-4 work simultaneously (no dependencies):
- Each agent reads their assigned doc
- Builds their component in isolation
- Mocks dependencies from other agents
- Documents their APIs and interfaces

### Step 4: Integration (Week 3-4)
Agents 5-7 work on features requiring Phase 1 components:
- Read documentation from dependent agents
- Implement integrations
- Test connections between components

### Step 5: Testing & Deployment (Week 5-6)
- Follow 10-INTEGRATION-TESTING.md for E2E tests
- Use 09-DEPLOYMENT.md for production deployment

## 📊 Development Phases

```
Phase 1: Foundation (Parallel)
├─ Agent 1: Database ─────────────┐
├─ Agent 2: Frontend ─────────────┤
├─ Agent 3: WebSocket ────────────├─► Week 1-2
└─ Agent 4: Redis Queue ──────────┘

Phase 2: Integration (Sequential)
├─ Agent 5: MCP Server ───────────┐
├─ Agent 6: Voice Pipeline ───────├─► Week 3-4
└─ Agent 7: Stripe ───────────────┘

Phase 3: Testing & Deployment
└─ All Agents: Integration ───────► Week 5-6
```

## 🎯 Success Criteria

### Each Component Complete When:
- ✅ Code working in isolation
- ✅ Tests passing (>80% coverage)
- ✅ Documentation updated
- ✅ APIs clearly defined
- ✅ Environment variables documented

### MVP Complete When:
- ✅ User can sign up and see dashboard
- ✅ Agent can request call via MCP
- ✅ Queue system processes requests (FIFO)
- ✅ Calls connect and transcribe in real-time
- ✅ Users can upgrade to Pro tier
- ✅ System handles 5+ concurrent calls
- ✅ End-to-end latency < 2 seconds

## 🛠 Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 + Clerk + Vercel |
| Database | Neon Postgres + Drizzle ORM |
| Queue/State | Upstash Redis |
| WebSocket | Railway + Node.js |
| Telephony | Twilio |
| STT | Deepgram |
| TTS | ElevenLabs |
| Storage | Cloudflare R2 |
| Payments | Stripe |

## 📞 Key Features

### Free Tier
- Shared phone booth (1 number)
- Queue system (FIFO)
- 5-minute call limit
- 7-day history

### Pro Tier ($39/mo)
- Dedicated booth
- Own phone number
- No queue
- Unlimited duration
- 90-day history

### Technical Requirements
- **Latency**: < 2 seconds end-to-end
- **Uptime**: 99.5%+
- **Accuracy**: 90%+ transcription
- **Queue**: < 3 min average wait

## 🔗 Key Integration Points

### MCP Server ↔ Redis Queue
- MCP adds requests to queue
- Queue manager processes requests

### WebSocket ↔ Voice Services
- Twilio streams audio to WebSocket server
- Deepgram provides transcription
- ElevenLabs generates speech

### Frontend ↔ Redis Pub/Sub
- Real-time dashboard updates
- Queue visualization
- Live transcripts

## 💡 Tips for Success

1. **Start with 00-PROJECT-OVERVIEW.md** - Understand the big picture first
2. **Read 01-ARCHITECTURE.md** - Know how components interact before coding
3. **Follow 11-AGENT-TEAM-BEST-PRACTICES.md** - Avoid common pitfalls
4. **Mock dependencies** - Don't wait for other agents to finish
5. **Document as you go** - Update docs with actual API contracts
6. **Test incrementally** - Don't wait until the end to integrate

## 📝 Communication Template

When completing your component, provide:

```markdown
## Component: [Your Component Name]

### Status: Complete ✅

### Provides:
- API endpoint: POST /api/your-endpoint
- Function: yourFunction(params) → returns result
- WebSocket: wss://your-server/path

### Dependencies Met:
- ✅ Environment variables set
- ✅ Tests passing
- ✅ Deployed to staging

### Known Issues:
- [ ] Minor: Edge case X not handled
- [ ] TODO: Optimize Y for performance

### How to Test:
1. Set env vars: ...
2. Run: npm run dev
3. Test: curl http://localhost:3000/test
4. Expected: { success: true }

### Next Steps:
- Integration with [Other Component]
- Performance testing
```

## 🚨 Getting Help

If stuck:
1. Re-read the architecture document
2. Check the component's acceptance criteria
3. Review the best practices guide
4. Test your component in isolation first
5. Check logs for error messages

## 🎉 Let's Build!

You now have everything you need to build AgentBooth with agent teams. Each document is optimized for AI agents to read and implement independently while coordinating on integration points.

Remember: Ship fast, learn from users, iterate! 🚀

---

**Questions?** Refer to 11-AGENT-TEAM-BEST-PRACTICES.md for troubleshooting and coordination strategies.
