# AgentBooth - MCP Server

## Agent Assignment
**Agent 5: MCP Server**

## Overview
Implement the MCP (Model Context Protocol) server that exposes tools for AI agents to make phone calls.

## Technology
- **@modelcontextprotocol/sdk** (MCP SDK)
- **Node.js/TypeScript**
- **Railway** for hosting

## MCP Tools

### 1. agentbooth_call

```typescript
{
  name: "agentbooth_call",
  description: "Make a phone call through AgentBooth",
  inputSchema: {
    type: "object",
    properties: {
      phone_number: {
        type: "string",
        description: "Phone number in E.164 format (e.g., +1234567890)"
      },
      context: {
        type: "string",
        description: "What you want to accomplish on the call"
      },
      max_duration: {
        type: "number",
        description: "Maximum call duration in seconds (optional)"
      }
    },
    required: ["phone_number", "context"]
  }
}
```

### 2. agentbooth_status

```typescript
{
  name: "agentbooth_status",
  description: "Check your call status or queue position",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

### 3. agentbooth_cancel

```typescript
{
  name: "agentbooth_cancel",
  description: "Cancel your queued call",
  inputSchema: {
    type: "object",
    properties: {
      call_id: {
        type: "string",
        description: "Call ID to cancel"
      }
    },
    required: ["call_id"]
  }
}
```

## Implementation

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { QueueManager } from './queue/QueueManager.js';
import { validatePhoneNumber } from './utils/validation.js';

const server = new Server(
  {
    name: 'agentbooth-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const queueManager = new QueueManager();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'agentbooth_call',
        description: 'Make a phone call through AgentBooth',
        inputSchema: {
          type: 'object',
          properties: {
            phone_number: {
              type: 'string',
              description: 'Phone number in E.164 format'
            },
            context: {
              type: 'string',
              description: 'What you want to accomplish'
            },
            max_duration: {
              type: 'number',
              description: 'Max duration in seconds (optional)'
            }
          },
          required: ['phone_number', 'context']
        }
      },
      {
        name: 'agentbooth_status',
        description: 'Check call status or queue position',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'agentbooth_call':
      return await handleAgentBoothCall(args);
    case 'agentbooth_status':
      return await handleStatus(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function handleAgentBoothCall(args: any) {
  // Validate inputs
  const phoneNumber = args.phone_number;
  if (!validatePhoneNumber(phoneNumber)) {
    return {
      content: [{
        type: 'text',
        text: 'Invalid phone number format. Use E.164 format: +1234567890'
      }],
      isError: true
    };
  }
  
  // Get user's booth (from API key)
  const userId = await getUserFromApiKey(request.headers.authorization);
  const boothId = await getBoothForUser(userId);
  
  // Generate call ID
  const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to queue
  const { position, estimatedWait } = await queueManager.addToQueue(boothId, {
    callId,
    agentId: args.agent_id || 'unknown',
    phoneNumber: phoneNumber,
    context: args.context
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        call_id: callId,
        booth_id: boothId,
        status: 'queued',
        queue_position: position,
        estimated_wait_seconds: estimatedWait,
        message: position === 0 
          ? 'Your call will start shortly'
          : `You are #${position + 1} in queue. Est. wait: ${Math.ceil(estimatedWait / 60)} minutes`
      }, null, 2)
    }]
  };
}

async function handleStatus(args: any) {
  const userId = await getUserFromApiKey(request.headers.authorization);
  const currentCall = await redis.get(`agent:${userId}:current_call`);
  
  if (!currentCall) {
    return {
      content: [{
        type: 'text',
        text: 'No active or queued calls'
      }]
    };
  }
  
  const callData = await redis.hgetall(`call:${currentCall}`);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(callData, null, 2)
    }]
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentBooth MCP server running');
}

main().catch(console.error);
```

## Authentication

```typescript
// src/auth/apiKeyAuth.ts
import { createHash } from 'crypto';
import { getUserByApiKey } from '../db/apiKeys';

export async function getUserFromApiKey(authHeader: string): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const apiKey = authHeader.substring(7);
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const user = await getUserByApiKey(keyHash);
  if (!user) {
    throw new Error('Invalid API key');
  }
  
  // Update last used
  await updateApiKeyLastUsed(keyHash);
  
  return user.id;
}
```

## Validation

```typescript
// src/utils/validation.ts
export function validatePhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export function validateContext(context: string): boolean {
  return context.length > 0 && context.length < 1000;
}
```

## Acceptance Criteria

- ✅ MCP server exposes agentbooth_call tool
- ✅ API key authentication working
- ✅ Phone number validation
- ✅ Queue integration
- ✅ Status checking
- ✅ Error handling with helpful messages
