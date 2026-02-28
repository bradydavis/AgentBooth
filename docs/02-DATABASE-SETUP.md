# AgentBooth - Database Setup (Neon Postgres)

## Agent Assignment
**Agent 1: Database & Backend Setup**

## Overview
Set up the Neon Postgres database with schema for users, booths, calls, and billing. This is the persistent storage layer for AgentBooth.

## Dependencies
- ✅ Neon account (no external services needed)
- ⚠️ Will be used by: Frontend API routes, MCP Server (read-only)

## Technology
- **Neon Postgres** (serverless Postgres with auto-scaling)
- **Drizzle ORM** (TypeScript-first ORM, recommended)
- **Alternative**: Prisma ORM (if preferred)

## Setup Steps

### 1. Create Neon Project

```bash
# Go to neon.tech and create a new project
# Name: agentbooth-production
# Region: Choose closest to your users (us-east-1 recommended)

# Get connection string from Neon dashboard:
# Format: postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### 2. Install Dependencies

```bash
# In your frontend/ directory
npm install @neondatabase/serverless
npm install drizzle-orm drizzle-kit
npm install -D @types/node

# For Prisma alternative:
# npm install @prisma/client
# npm install -D prisma
```

### 3. Environment Variables

```bash
# .env.local (for local development)
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# For production, add to Vercel environment variables
```

## Database Schema

### Schema Design Philosophy
- Use Clerk `userId` as foreign key (don't duplicate user data)
- Store only what's not in Redis (long-term data)
- Optimize for read queries (call history, analytics)
- Use indexes on frequently queried columns

### Complete Schema (SQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (minimal, Clerk is source of truth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Booths table
CREATE TABLE booths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booth_type VARCHAR(20) NOT NULL, -- 'free', 'dedicated'
  twilio_number VARCHAR(20), -- NULL for free tier booths
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'suspended'
  settings JSONB DEFAULT '{}', -- Booth configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booths_user_id ON booths(user_id);
CREATE INDEX idx_booths_twilio_number ON booths(twilio_number);

-- Calls table (long-term storage, hot data in Redis)
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booth_id UUID REFERENCES booths(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL, -- Agent identifier
  phone_number VARCHAR(20) NOT NULL,
  twilio_call_sid VARCHAR(100), -- Twilio's call ID
  duration INTEGER, -- Duration in seconds
  cost DECIMAL(10, 4), -- Cost in USD
  status VARCHAR(20) NOT NULL, -- 'queued', 'ringing', 'in_progress', 'completed', 'failed'
  transcript_url TEXT, -- URL to transcript in R2
  recording_url TEXT, -- URL to recording in R2
  metadata JSONB DEFAULT '{}', -- Additional data (context, etc.)
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calls_booth_id ON calls(booth_id);
CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_phone_number ON calls(phone_number);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_status ON calls(status);

-- Credits table (for usage-based billing)
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 4) NOT NULL, -- Positive = credit, Negative = debit
  transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'call_charge', 'refund'
  description TEXT,
  reference_id UUID, -- Links to calls.id for call charges
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE INDEX idx_credits_created_at ON credits(created_at DESC);

-- Subscriptions table (Stripe integration)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(50) NOT NULL, -- 'pro', 'team'
  status VARCHAR(20) NOT NULL, -- 'active', 'canceled', 'past_due'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- API Keys table (for MCP authentication)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the key
  key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for display (e.g., "pb_1234...")
  name VARCHAR(100), -- User-friendly name
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Analytics table (pre-aggregated stats)
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  booth_id UUID REFERENCES booths(id) ON DELETE CASCADE,
  total_calls INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0, -- Total seconds
  total_cost DECIMAL(10, 4) DEFAULT 0,
  avg_duration INTEGER,
  avg_queue_wait INTEGER, -- Average wait time in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, booth_id)
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX idx_daily_stats_booth_id ON daily_stats(booth_id);
```

### Schema with Drizzle ORM (TypeScript)

```typescript
// frontend/lib/db/schema.ts
import { pgTable, uuid, varchar, timestamp, integer, decimal, text, jsonb, index, date } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clerkIdIdx: index('idx_users_clerk_id').on(table.clerkUserId),
  emailIdx: index('idx_users_email').on(table.email),
}));

export const booths = pgTable('booths', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  boothType: varchar('booth_type', { length: 20 }).notNull(),
  twilioNumber: varchar('twilio_number', { length: 20 }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_booths_user_id').on(table.userId),
  twilioNumberIdx: index('idx_booths_twilio_number').on(table.twilioNumber),
}));

export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  boothId: uuid('booth_id').references(() => booths.id, { onDelete: 'cascade' }),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  twilioCallSid: varchar('twilio_call_sid', { length: 100 }),
  duration: integer('duration'),
  cost: decimal('cost', { precision: 10, scale: 4 }),
  status: varchar('status', { length: 20 }).notNull(),
  transcriptUrl: text('transcript_url'),
  recordingUrl: text('recording_url'),
  metadata: jsonb('metadata').default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  boothIdIdx: index('idx_calls_booth_id').on(table.boothId),
  agentIdIdx: index('idx_calls_agent_id').on(table.agentId),
  phoneNumberIdx: index('idx_calls_phone_number').on(table.phoneNumber),
  startedAtIdx: index('idx_calls_started_at').on(table.startedAt),
  statusIdx: index('idx_calls_status').on(table.status),
}));

export const credits = pgTable('credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 4 }).notNull(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  description: text('description'),
  referenceId: uuid('reference_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_credits_user_id').on(table.userId),
  createdAtIdx: index('idx_credits_created_at').on(table.createdAt),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  planId: varchar('plan_id', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_subscriptions_user_id').on(table.userId),
  stripeIdIdx: index('idx_subscriptions_stripe_id').on(table.stripeSubscriptionId),
  statusIdx: index('idx_subscriptions_status').on(table.status),
}));

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('idx_api_keys_user_id').on(table.userId),
  hashIdx: index('idx_api_keys_hash').on(table.keyHash),
}));

export const dailyStats = pgTable('daily_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  boothId: uuid('booth_id').references(() => booths.id, { onDelete: 'cascade' }),
  totalCalls: integer('total_calls').default(0),
  totalDuration: integer('total_duration').default(0),
  totalCost: decimal('total_cost', { precision: 10, scale: 4 }).default('0'),
  avgDuration: integer('avg_duration'),
  avgQueueWait: integer('avg_queue_wait'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  dateIdx: index('idx_daily_stats_date').on(table.date),
  boothIdIdx: index('idx_daily_stats_booth_id').on(table.boothId),
}));
```

## Database Connection Setup

### Drizzle Configuration

```typescript
// frontend/lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

### Drizzle Kit Configuration

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## Migration Scripts

### Run Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate:pg

# Apply migrations to database
npx drizzle-kit push:pg

# Or using migrate programmatically:
# See frontend/lib/db/migrate.ts
```

### Migration File Example

```typescript
// frontend/lib/db/migrate.ts
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './index';

export async function runMigrations() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  console.log('Migrations complete');
}

// Run with: npx tsx lib/db/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
```

## Database Helper Functions

### User Operations

```typescript
// frontend/lib/db/users.ts
import { db } from './index';
import { users, booths } from './schema';
import { eq } from 'drizzle-orm';

export async function createUser(clerkUserId: string, email: string) {
  const [user] = await db.insert(users).values({
    clerkUserId,
    email,
    tier: 'free',
  }).returning();
  
  // Create free booth for new user
  await db.insert(booths).values({
    userId: user.id,
    boothType: 'free',
    status: 'active',
  });
  
  return user;
}

export async function getUserByClerkId(clerkUserId: string) {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  
  return user;
}

export async function updateUserTier(userId: string, tier: 'free' | 'pro' | 'team') {
  const [user] = await db.update(users)
    .set({ tier, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  
  return user;
}
```

### Booth Operations

```typescript
// frontend/lib/db/booths.ts
import { db } from './index';
import { booths } from './schema';
import { eq } from 'drizzle-orm';

export async function getUserBooths(userId: string) {
  return db.select()
    .from(booths)
    .where(eq(booths.userId, userId));
}

export async function createDedicatedBooth(userId: string, twilioNumber: string) {
  const [booth] = await db.insert(booths).values({
    userId,
    boothType: 'dedicated',
    twilioNumber,
    status: 'active',
  }).returning();
  
  return booth;
}

export async function getBoothById(boothId: string) {
  const [booth] = await db.select()
    .from(booths)
    .where(eq(booths.id, boothId))
    .limit(1);
  
  return booth;
}
```

### Call Operations

```typescript
// frontend/lib/db/calls.ts
import { db } from './index';
import { calls } from './schema';
import { eq, desc } from 'drizzle-orm';

export async function createCall(data: {
  boothId: string;
  agentId: string;
  phoneNumber: string;
  metadata?: any;
}) {
  const [call] = await db.insert(calls).values({
    ...data,
    status: 'queued',
  }).returning();
  
  return call;
}

export async function updateCall(callId: string, data: Partial<typeof calls.$inferInsert>) {
  const [call] = await db.update(calls)
    .set(data)
    .where(eq(calls.id, callId))
    .returning();
  
  return call;
}

export async function getCallHistory(boothId: string, limit: number = 50, offset: number = 0) {
  return db.select()
    .from(calls)
    .where(eq(calls.boothId, boothId))
    .orderBy(desc(calls.startedAt))
    .limit(limit)
    .offset(offset);
}

export async function getCallById(callId: string) {
  const [call] = await db.select()
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);
  
  return call;
}
```

## Seed Data (Development)

```typescript
// frontend/lib/db/seed.ts
import { db } from './index';
import { users, booths, calls } from './schema';

export async function seedDatabase() {
  console.log('Seeding database...');
  
  // Create test user
  const [testUser] = await db.insert(users).values({
    clerkUserId: 'user_test123',
    email: 'test@agentbooth.app',
    tier: 'free',
  }).returning();
  
  // Create free booth
  const [freeBooth] = await db.insert(booths).values({
    userId: testUser.id,
    boothType: 'free',
    status: 'active',
  }).returning();
  
  // Create sample calls
  await db.insert(calls).values([
    {
      boothId: freeBooth.id,
      agentId: 'agent-test-1',
      phoneNumber: '+1234567890',
      status: 'completed',
      duration: 120,
      cost: '0.50',
      startedAt: new Date(Date.now() - 86400000),
      endedAt: new Date(Date.now() - 86400000 + 120000),
    },
    {
      boothId: freeBooth.id,
      agentId: 'agent-test-2',
      phoneNumber: '+1234567891',
      status: 'completed',
      duration: 180,
      cost: '0.75',
      startedAt: new Date(Date.now() - 43200000),
      endedAt: new Date(Date.now() - 43200000 + 180000),
    },
  ]);
  
  console.log('Database seeded successfully');
}

// Run with: npx tsx lib/db/seed.ts
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
```

## Testing Database Queries

```typescript
// frontend/lib/db/__tests__/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUser, getUserByClerkId } from '../users';

describe('User Database Operations', () => {
  it('should create a new user', async () => {
    const user = await createUser('test_clerk_123', 'test@example.com');
    
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.tier).toBe('free');
  });
  
  it('should retrieve user by Clerk ID', async () => {
    await createUser('test_clerk_456', 'test2@example.com');
    const user = await getUserByClerkId('test_clerk_456');
    
    expect(user).toBeDefined();
    expect(user?.email).toBe('test2@example.com');
  });
});
```

## Acceptance Criteria

- ✅ Database schema created in Neon
- ✅ Drizzle ORM configured and connected
- ✅ All tables created with proper indexes
- ✅ Migration system working
- ✅ Helper functions for CRUD operations
- ✅ Seed script for development data
- ✅ Basic tests passing
- ✅ Environment variables documented

## Handoff Notes

**What's Complete:**
- Full database schema with indexes
- Drizzle ORM setup
- Helper functions for common queries
- Migration system

**What's Next:**
- Frontend API routes will use these helpers
- MCP server needs read access to validate users
- WebSocket server needs to log completed calls

**Environment Variables Needed:**
```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

**Known Issues:**
- None yet, this is a greenfield setup

**Testing:**
```bash
# Test database connection
npx tsx lib/db/test-connection.ts

# Run migrations
npx drizzle-kit push:pg

# Seed database
npx tsx lib/db/seed.ts
```
