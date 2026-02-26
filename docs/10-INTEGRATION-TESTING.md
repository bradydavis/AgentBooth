# PhoneBooth - Integration Testing

## End-to-End Test Scenarios

### Test 1: Free Tier User Journey
```
1. Sign up with Clerk
2. Verify free booth created
3. Make test call via MCP
4. Verify queued
5. Process queue
6. Verify call initiated
7. Complete call
8. Verify history saved
```

### Test 2: Upgrade Flow
```
1. User clicks upgrade
2. Stripe checkout completed
3. Webhook received
4. Booth provisioned
5. Twilio number assigned
6. User can make instant calls
```

### Test 3: Queue System
```
1. Start 3 agents simultaneously
2. Verify all queued
3. Verify FIFO processing
4. Verify queue updates in UI
5. Verify wait time estimates
```

### Test 4: Audio Pipeline
```
1. Initiate test call
2. Send test audio to Twilio WS
3. Verify Deepgram transcript
4. Verify agent response
5. Verify ElevenLabs audio
6. Measure end-to-end latency
```

## Automated Tests

### API Tests
```typescript
// tests/api/booths.test.ts
describe('Booth API', () => {
  it('should return user booths', async () => {
    const response = await fetch('/api/booths', {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.booths).toBeDefined();
  });
});
```

### MCP Tests
```typescript
// tests/mcp/phonebooth_call.test.ts
describe('phonebooth_call tool', () => {
  it('should queue a call request', async () => {
    const result = await mcpClient.callTool('phonebooth_call', {
      phone_number: '+1234567890',
      context: 'Test call'
    });
    expect(result.call_id).toBeDefined();
    expect(result.status).toBe('queued');
  });
});
```

### WebSocket Tests
```typescript
// tests/websocket/twilio.test.ts
describe('Twilio WebSocket', () => {
  it('should handle media stream', async () => {
    const ws = new WebSocket('ws://localhost:3001/media/test-call');
    
    ws.send(JSON.stringify({
      event: 'start',
      streamSid: 'MZ123'
    }));
    
    // Verify connection established
  });
});
```

## Load Testing

```bash
# Test queue with 100 concurrent agents
artillery quick --count 100 --num 1 \
  http://localhost:3000/api/mcp/phonebooth_call
```

## Acceptance Criteria

- ✅ All end-to-end scenarios passing
- ✅ API tests covering main routes
- ✅ MCP tools tested
- ✅ WebSocket connections tested
- ✅ Load tests showing acceptable performance
- ✅ Error cases handled gracefully
