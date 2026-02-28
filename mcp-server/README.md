# AgentBooth MCP Server

Exposes three MCP tools for AI agents to make phone calls through AgentBooth.

## Tools

- **agentbooth_call** — Queue a phone call
- **agentbooth_status** — Check call/queue status
- **agentbooth_cancel** — Cancel a queued call

## Setup (Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentbooth": {
      "command": "node",
      "args": ["/path/to/agentbooth/mcp-server/dist/index.js"],
      "env": {
        "PHONEBOOTH_API_KEY": "pb_your_api_key_here",
        "UPSTASH_REDIS_REST_URL": "https://...",
        "UPSTASH_REDIS_REST_TOKEN": "...",
        "DATABASE_URL": "postgresql://...",
        "WEBSOCKET_SERVER_URL": "https://agentbooth-ws.railway.app",
        "INTERNAL_API_KEY": "..."
      }
    }
  }
}
```

## Development

```bash
npm install
npm run dev    # watch mode with tsx
npm run build  # compile to dist/
```
