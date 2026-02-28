import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { QueueManager } from './queue/QueueManager.js';
import { validatePhoneNumber } from './utils/validation.js';
import { resolveUserAndBooth } from './auth/apiKeyAuth.js';

const queueManager = new QueueManager();

const server = new Server(
  { name: 'agentbooth-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'agentbooth_call',
      description:
        'Make a phone call through AgentBooth. The call is queued and processed in order. ' +
        'Returns a call_id and queue position. Use agentbooth_status to check progress.',
      inputSchema: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: 'Phone number in E.164 format, e.g. +15555550100',
          },
          context: {
            type: 'string',
            description: 'What you want to accomplish on the call (max 1000 chars)',
          },
          webhook_url: {
            type: 'string',
            description:
              'Optional URL to receive transcript events during the call. ' +
              'POST with { call_id, transcript, speaker, conversation_history, context }. ' +
              'Respond with { response_text, end_call? }.',
          },
          max_duration: {
            type: 'number',
            description: 'Maximum call duration in seconds (default: 300 for free tier)',
          },
        },
        required: ['phone_number', 'context'],
      },
    },
    {
      name: 'agentbooth_status',
      description: 'Check the status of your current call or queue position.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'agentbooth_cancel',
      description: 'Cancel a queued call before it starts.',
      inputSchema: {
        type: 'object',
        properties: {
          call_id: {
            type: 'string',
            description: 'The call_id returned by agentbooth_call',
          },
        },
        required: ['call_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // All tools require API key auth passed as the agent ID convention
  // In MCP, auth is typically passed via environment or headers at transport level.
  // For stdio transport: the PHONEBOOTH_API_KEY env var is set by the agent's config.
  const apiKey = process.env.PHONEBOOTH_API_KEY;
  if (!apiKey) {
    return errorResult('PHONEBOOTH_API_KEY environment variable not set. Configure your MCP client with your AgentBooth API key.');
  }

  let auth: { userId: string; boothId: string; tier: string };
  try {
    auth = await resolveUserAndBooth(apiKey);
  } catch {
    return errorResult('Invalid API key. Generate one at agentbooth.app/dashboard/settings');
  }

  switch (name) {
    case 'agentbooth_call':
      return handleCall(auth, args as Record<string, unknown>);
    case 'agentbooth_status':
      return handleStatus(auth);
    case 'agentbooth_cancel':
      return handleCancel(auth, args as Record<string, unknown>);
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
});

async function handleCall(
  auth: { userId: string; boothId: string; tier: string },
  args: Record<string, unknown>
) {
  const phoneNumber = args.phone_number as string;
  const context = args.context as string;
  const webhookUrl = args.webhook_url as string | undefined;
  const maxDuration = (args.max_duration as number | undefined) ??
    (auth.tier === 'free' ? 300 : undefined);

  if (!validatePhoneNumber(phoneNumber)) {
    return errorResult(
      'Invalid phone number. Use E.164 format: +15555550100 (country code + number, no spaces or dashes)'
    );
  }

  if (!context || context.length > 1000) {
    return errorResult('context is required and must be under 1000 characters');
  }

  const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { position, estimatedWaitSeconds } = await queueManager.addToQueue(auth.boothId, {
    callId,
    agentId: auth.userId,
    phoneNumber,
    context,
    webhookUrl,
    maxDuration,
  });

  const waitMinutes = Math.ceil(estimatedWaitSeconds / 60);
  const message =
    position === 0
      ? 'Your call will start within seconds.'
      : `You are #${position + 1} in queue. Estimated wait: ${waitMinutes} minute${waitMinutes !== 1 ? 's' : ''}.`;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            call_id: callId,
            booth_id: auth.boothId,
            status: 'queued',
            queue_position: position,
            estimated_wait_seconds: estimatedWaitSeconds,
            message,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleStatus(auth: { userId: string; boothId: string; tier: string }) {
  const status = await queueManager.getAgentStatus(auth.userId, auth.boothId);
  return {
    content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
  };
}

async function handleCancel(
  auth: { userId: string; boothId: string; tier: string },
  args: Record<string, unknown>
) {
  const callId = args.call_id as string;
  if (!callId) return errorResult('call_id is required');

  const removed = await queueManager.removeFromQueue(auth.boothId, callId);
  return {
    content: [
      {
        type: 'text',
        text: removed
          ? `Call ${callId} has been cancelled.`
          : `Call ${callId} not found in queue (it may have already started or completed).`,
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentBooth MCP server running (stdio)');
}

main().catch((err) => {
  console.error('MCP server fatal error:', err);
  process.exit(1);
});
