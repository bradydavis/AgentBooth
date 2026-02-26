# PhoneBooth - Frontend Application

## Agent Assignment
**Agent 2: Frontend Application**

## Overview
Build the Next.js 14 frontend with App Router, Clerk authentication, and real-time dashboard showing booth status and queue visualization.

## Dependencies
- ✅ Neon Postgres (from Agent 1)
- ⚠️ Needs: Upstash Redis for real-time updates
- ⚠️ Needs: WebSocket server URL for live updates

## Technology Stack
- **Next.js 14** with App Router
- **React 18** with Server Components
- **Tailwind CSS** for styling
- **Clerk** for authentication
- **shadcn/ui** for UI components
- **Recharts** for analytics charts
- **WebSocket** for real-time updates

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with Clerk provider
│   ├── page.tsx                # Landing page
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout (protected)
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── history/page.tsx # Call history
│   │   │   └── settings/page.tsx # Booth settings
│   │   └── upgrade/page.tsx    # Upgrade flow
│   └── api/
│       ├── booths/route.ts     # Booth management API
│       ├── calls/route.ts      # Call history API
│       ├── ws/route.ts         # WebSocket proxy
│       └── stripe/
│           └── webhook/route.ts # Stripe webhooks
├── components/
│   ├── booth/
│   │   ├── BoothStatus.tsx     # Shows booth status (idle/occupied)
│   │   ├── QueueVisualization.tsx # Queue display
│   │   └── LiveTranscript.tsx   # Real-time transcript
│   ├── ui/                      # shadcn components
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
├── lib/
│   ├── db/                      # Database (from Agent 1)
│   ├── redis.ts                 # Redis client
│   ├── utils.ts                 # Utilities
│   └── hooks/
│       ├── useWebSocket.ts      # WebSocket hook
│       └── useBooths.ts         # Booth data hook
└── public/
    └── assets/
```

## Setup Steps

### 1. Initialize Next.js Project

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir
cd frontend
npm install @clerk/nextjs
npm install @upstash/redis
npm install recharts date-fns
npm install lucide-react class-variance-authority clsx tailwind-merge
```

### 2. Install shadcn/ui

```bash
npx shadcn-ui@latest init
# Install needed components
npx shadcn-ui@latest add button card badge separator skeleton alert
```

### 3. Environment Variables

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

NEXT_PUBLIC_WEBSOCKET_URL=wss://phonebooth-ws.railway.app
```

## Authentication Setup

### Root Layout with Clerk

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### Protected Dashboard Layout

```typescript
// app/(dashboard)/layout.tsx
import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.Node }) {
  const { userId } = auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

## Core Components

### Booth Status Component

```typescript
// components/booth/BoothStatus.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock, Users } from 'lucide-react';

interface BoothStatusProps {
  boothId: string;
  boothType: 'free' | 'dedicated';
}

export function BoothStatus({ boothId, boothType }: BoothStatusProps) {
  const [status, setStatus] = useState<'idle' | 'occupied' | 'ringing'>('idle');
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [queueLength, setQueueLength] = useState(0);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/dashboard`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'booth_status' && data.boothId === boothId) {
        setStatus(data.status);
        setCurrentCall(data.currentCall);
      }
      if (data.type === 'queue_update' && data.boothId === boothId) {
        setQueueLength(data.queueLength);
      }
    };

    return () => ws.close();
  }, [boothId]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">
          {boothType === 'free' ? '🏢 Shared Booth' : '🚪 Your Booth'}
        </h2>
        <Badge variant={status === 'idle' ? 'secondary' : 'default'}>
          {status === 'idle' ? '🟢 IDLE' : '🔴 OCCUPIED'}
        </Badge>
      </div>
      
      {status === 'occupied' && currentCall && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>Calling: {currentCall.phoneNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Duration: {formatDuration(currentCall.duration)}</span>
          </div>
        </div>
      )}

      {boothType === 'free' && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            <span>{queueLength} agents in queue</span>
          </div>
        </div>
      )}
    </Card>
  );
}
```

### Queue Visualization

```typescript
// components/booth/QueueVisualization.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QueueItem {
  agentId: string;
  position: number;
  estimatedWait: number;
}

export function QueueVisualization({ boothId }: { boothId: string }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/dashboard`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'queue_update' && data.boothId === boothId) {
        setQueue(data.queue);
      }
    };

    return () => ws.close();
  }, [boothId]);

  if (queue.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No agents in queue</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Queue ({queue.length} waiting)</h3>
      <div className="space-y-3">
        {queue.map((item, index) => (
          <div key={item.agentId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{index + 1}</Badge>
              <div>
                <p className="font-medium">🤖 {item.agentId}</p>
                <p className="text-sm text-muted-foreground">
                  Est. wait: {Math.ceil(item.estimatedWait / 60)} min
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### Live Transcript Component

```typescript
// components/booth/LiveTranscript.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TranscriptLine {
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: number;
}

export function LiveTranscript({ callId }: { callId: string }) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/dashboard`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript' && data.callId === callId) {
        setTranscript((prev) => [...prev, {
          speaker: data.speaker,
          text: data.text,
          timestamp: data.timestamp
        }]);
      }
    };

    return () => ws.close();
  }, [callId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Live Transcript</h3>
      <ScrollArea className="h-96">
        <div className="space-y-3">
          {transcript.map((line, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                line.speaker === 'caller'
                  ? 'bg-blue-50 ml-12'
                  : 'bg-green-50 mr-12'
              }`}
            >
              <p className="text-sm font-medium mb-1">
                {line.speaker === 'caller' ? '👤 Caller' : '🤖 Agent'}
              </p>
              <p className="text-sm">{line.text}</p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </Card>
  );
}
```

## API Routes

### Booth Management API

```typescript
// app/api/booths/route.ts
import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { getUserBooths } from '@/lib/db/booths';
import { getUserByClerkId } from '@/lib/db/users';
import { redis } from '@/lib/redis';

export async function GET() {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user from database
  const user = await getUserByClerkId(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get user's booths
  const booths = await getUserBooths(user.id);

  // Enrich with real-time data from Redis
  const enrichedBooths = await Promise.all(
    booths.map(async (booth) => {
      const state = await redis.hgetall(`booth:${booth.id}:state`);
      const queueLength = await redis.llen(`booth:${booth.id}:queue`);

      return {
        ...booth,
        status: state.status || 'idle',
        currentCall: state.currentCallId || null,
        queueLength,
      };
    })
  );

  return NextResponse.json({ booths: enrichedBooths });
}
```

### Call History API

```typescript
// app/api/calls/route.ts
import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { getCallHistory } from '@/lib/db/calls';

export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boothId = searchParams.get('boothId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!boothId) {
    return NextResponse.json({ error: 'boothId required' }, { status: 400 });
  }

  const calls = await getCallHistory(boothId, limit, offset);
  
  return NextResponse.json({ calls });
}
```

## Dashboard Page

```typescript
// app/(dashboard)/dashboard/page.tsx
import { auth } from '@clerk/nextjs';
import { getUserByClerkId } from '@/lib/db/users';
import { getUserBooths } from '@/lib/db/booths';
import { BoothStatus } from '@/components/booth/BoothStatus';
import { QueueVisualization } from '@/components/booth/QueueVisualization';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function DashboardPage() {
  const { userId } = auth();
  const user = await getUserByClerkId(userId!);
  const booths = await getUserBooths(user!.id);

  const hasFreeBooth = booths.some(b => b.boothType === 'free');
  const hasDedicatedBooth = booths.some(b => b.boothType === 'dedicated');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🚪 PhoneBooth</h1>
        {!hasDedicatedBooth && (
          <Link href="/upgrade">
            <Button>Upgrade to Pro</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {booths.map((booth) => (
          <div key={booth.id}>
            <BoothStatus 
              boothId={booth.id} 
              boothType={booth.boothType as 'free' | 'dedicated'}
            />
            {booth.boothType === 'free' && (
              <div className="mt-4">
                <QueueVisualization boothId={booth.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/dashboard/history">
          <Button variant="outline">View Call History →</Button>
        </Link>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- ✅ Next.js 14 app initialized with App Router
- ✅ Clerk authentication working (sign up/in)
- ✅ Dashboard shows booth status (idle/occupied)
- ✅ Real-time queue visualization
- ✅ Live transcript display during calls
- ✅ Call history page with pagination
- ✅ Upgrade flow to Pro tier
- ✅ Mobile responsive design
- ✅ Error handling with user-friendly messages

## Handoff Notes

**What's Complete:**
- Basic Next.js structure
- Clerk authentication
- Dashboard UI components
- Real-time WebSocket connection
- API routes for booths and calls

**What's Next:**
- WebSocket server needs to implement /dashboard endpoint
- Stripe integration for upgrade flow
- Advanced analytics views

**Environment Variables Needed:**
See section above

**Testing:**
```bash
npm run dev
# Visit http://localhost:3000
# Test sign up flow
# Check dashboard displays correctly
```
