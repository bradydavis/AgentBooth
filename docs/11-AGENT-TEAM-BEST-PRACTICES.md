# Building AgentBooth with Agent Teams - Best Practices

## Overview
This guide contains best practices for coordinating multiple AI agents to build AgentBooth efficiently.

## Team Structure & Workflow

### Phase 1: Foundation (Parallel Work)
**Agents 1-4 work simultaneously on independent components:**

**Agent 1 (Database):**
- Set up Neon Postgres
- Create schema with Drizzle
- Write helper functions
- **Deliverable:** Database ready + migration scripts

**Agent 2 (Frontend Shell):**
- Initialize Next.js project
- Set up Clerk authentication
- Create basic UI components
- **Deliverable:** App structure + auth working

**Agent 3 (WebSocket Server):**
- Set up Railway project
- Create basic Express server
- Set up WebSocket handling
- **Deliverable:** Server responding to health checks

**Agent 4 (Redis Queue):**
- Set up Upstash Redis
- Implement queue operations
- Write pub/sub handlers
- **Deliverable:** Queue system tested locally

**Timeline:** Week 1-2

### Phase 2: Integration (Sequential Dependencies)
**Agents work on features that require Phase 1 components:**

**Agent 5 (MCP Server):**
- Requires: Redis (Agent 4)
- Implement MCP protocol
- Add authentication
- **Deliverable:** MCP tools callable

**Agent 6 (Voice Pipeline):**
- Requires: WebSocket Server (Agent 3)
- Integrate Twilio/Deepgram/ElevenLabs
- Test audio conversions
- **Deliverable:** End-to-end audio working

**Agent 7 (Stripe):**
- Requires: Frontend (Agent 2), Database (Agent 1)
- Implement checkout flow
- Handle webhooks
- **Deliverable:** Upgrade flow working

**Timeline:** Week 3-4

### Phase 3: Polish & Testing (Collaborative)
**All agents or single integration agent:**
- Connect all pieces
- End-to-end testing
- Bug fixes
- Documentation

**Timeline:** Week 5-6

## Communication Protocol

### Each Agent Should Document:

**1. Component Interface**
```markdown
## My Component: [Name]
### Provides:
- Function X(params) → returns Y
- API endpoint /api/route
- WebSocket endpoint wss://...

### Requires:
- From Agent N: Function Z
- Environment variable: VAR_NAME
```

**2. Known Issues**
```markdown
## Known Issues
- [ ] Edge case not handled: [description]
- [ ] TODO: Optimization needed for [feature]
- [ ] Waiting on: Agent X to provide [dependency]
```

**3. Testing Instructions**
```markdown
## How to Test My Component
1. Set environment variables: ...
2. Run: npm run dev
3. Test with: curl localhost:3000/endpoint
4. Expected result: ...
```

## Best Practices by Phase

### Foundation Phase

**DO:**
- ✅ Work independently on your component
- ✅ Mock dependencies from other agents
- ✅ Write comprehensive tests
- ✅ Document your APIs clearly
- ✅ Use type-safe interfaces

**DON'T:**
- ❌ Wait for other agents to finish
- ❌ Hard-code values (use env vars)
- ❌ Skip documentation
- ❌ Make assumptions about other components

### Integration Phase

**DO:**
- ✅ Read other agents' documentation first
- ✅ Test integrations incrementally
- ✅ Add error handling at boundaries
- ✅ Log all inter-service calls
- ✅ Report integration issues clearly

**DON'T:**
- ❌ Modify other agents' code without asking
- ❌ Skip API contract validation
- ❌ Ignore type mismatches
- ❌ Deploy without testing locally

### Testing Phase

**DO:**
- ✅ Test happy paths and error cases
- ✅ Load test critical paths
- ✅ Monitor latency and errors
- ✅ Document workarounds
- ✅ Create integration test suite

## Common Pitfalls & Solutions

### Pitfall 1: Environment Variable Mismatch
**Problem:** Agent A expects `DATABASE_URL`, Agent B set `DB_URL`

**Solution:** 
- Create `.env.example` file early
- Document all env vars in deployment doc
- Use validation on startup

### Pitfall 2: Async Timing Issues
**Problem:** Agent A queries data before Agent B finishes writing

**Solution:**
- Use Redis pub/sub for event-driven flow
- Add proper await/async handling
- Implement retry logic with exponential backoff

### Pitfall 3: Type Mismatches
**Problem:** Agent A returns `string`, Agent B expects `number`

**Solution:**
- Share TypeScript types in `shared/types/`
- Validate inputs at boundaries
- Use Zod or similar for runtime validation

### Pitfall 4: Circular Dependencies
**Problem:** Agent A needs Agent B, Agent B needs Agent A

**Solution:**
- Redesign to remove circular dependency
- Use message queue as intermediary
- Extract shared logic to separate service

## Code Quality Standards

### All Agents Should:

1. **Use TypeScript**
   - Strict mode enabled
   - No `any` types
   - Proper error types

2. **Handle Errors**
   ```typescript
   try {
     await operation();
   } catch (error) {
     logger.error('Operation failed:', error);
     // Graceful degradation or retry
   }
   ```

3. **Log Appropriately**
   ```typescript
   logger.info('Starting operation', { userId, action });
   logger.error('Operation failed', { error, context });
   ```

4. **Write Tests**
   - Unit tests for pure functions
   - Integration tests for API endpoints
   - E2E tests for critical flows

## Handoff Checklist

When passing work to another agent:

- [ ] Code is committed and pushed
- [ ] Documentation updated
- [ ] Environment variables documented
- [ ] Tests passing
- [ ] Deployment instructions clear
- [ ] Known issues listed
- [ ] API contracts documented
- [ ] Example usage provided

## Integration Testing Strategy

### Step 1: Component Testing
Each agent tests their component in isolation with mocked dependencies.

### Step 2: Pair Integration
Test integration between two components:
- Frontend ↔ Database
- WebSocket ↔ Redis
- MCP ↔ Queue

### Step 3: Full Integration
Test complete user flows end-to-end:
- Sign up → Make call → View history
- Upgrade → Get booth → Make instant call

### Step 4: Load Testing
Test with realistic load:
- 10 concurrent calls
- 50 agents in queue
- Multiple users simultaneously

## Success Metrics

### For Each Agent:
- ✅ Component working in isolation
- ✅ Tests passing (>80% coverage)
- ✅ Documentation complete
- ✅ Deployed to staging

### For Integration:
- ✅ All E2E scenarios passing
- ✅ No critical bugs
- ✅ Latency < 2s for calls
- ✅ Error rate < 1%

## When Things Go Wrong

### Debug Checklist:
1. Check logs in each service
2. Verify environment variables
3. Test each component in isolation
4. Check network connectivity
5. Verify API contracts match
6. Look for race conditions
7. Check Redis state manually

### Getting Unstuck:
- Review architecture diagram
- Re-read component documentation
- Test with curl/Postman first
- Add verbose logging
- Simplify to minimal reproduction

## Final Tips

1. **Start Simple**: Get one complete flow working before adding features
2. **Test Early**: Don't wait until integration phase to test
3. **Communicate Often**: Update documentation as you go
4. **Think Async**: Everything can fail, retry, or be delayed
5. **Monitor Everything**: You can't fix what you can't see

Remember: The goal is a working MVP, not perfect code. Ship it, learn from users, iterate.

Good luck building AgentBooth! 🚀
