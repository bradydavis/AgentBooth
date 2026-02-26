# PhoneBooth - Deployment Guide

## Complete Deployment Checklist

### 1. Neon Postgres
```bash
1. Create project at neon.tech
2. Copy connection string
3. Run migrations
4. Seed initial data
```

### 2. Upstash Redis
```bash
1. Create database at upstash.com
2. Copy REST URL and token
3. Test connection
```

### 3. Clerk
```bash
1. Create application at clerk.com
2. Configure redirect URLs
3. Copy API keys
4. Enable email/password authentication
```

### 4. Vercel (Frontend)
```bash
1. Connect GitHub repo
2. Select frontend/ directory
3. Add environment variables:
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
   - DATABASE_URL
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
4. Deploy
```

### 5. Railway (WebSocket Server)
```bash
1. Create new project
2. Connect repo → websocket-server/
3. Add environment variables:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - DEEPGRAM_API_KEY
   - ELEVENLABS_API_KEY
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
4. Deploy
5. Copy public URL
```

### 6. Railway (MCP Server)
```bash
1. Create new project
2. Connect repo → mcp-server/
3. Add environment variables
4. Deploy
```

### 7. Twilio
```bash
1. Purchase phone number
2. Configure webhook URL:
   https://your-websocket-server.railway.app/twiml/{callId}
3. Enable Media Streams
```

### 8. Stripe
```bash
1. Create products (Pro, Team)
2. Create webhook endpoint:
   https://your-app.vercel.app/api/stripe/webhook
3. Add webhook secret to env
```

## Environment Variables Master List

### Frontend (.env.local)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...@...neon.tech/...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_WEBSOCKET_URL=wss://...railway.app
```

### WebSocket Server
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

## Health Checks

### Test Each Service
```bash
# Frontend
curl https://your-app.vercel.app

# WebSocket Server
curl https://your-ws.railway.app/health

# Database
psql $DATABASE_URL -c "SELECT 1"

# Redis
redis-cli -u $UPSTASH_REDIS_REST_URL PING
```

## Monitoring

### Set up alerts for:
- High error rates (Sentry)
- WebSocket disconnections
- Queue processing delays
- Database connection issues
- Twilio API failures
