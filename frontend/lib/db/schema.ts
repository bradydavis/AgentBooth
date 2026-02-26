import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  decimal,
  text,
  jsonb,
  index,
  date,
  unique,
} from 'drizzle-orm/pg-core';

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
  status: varchar('status', { length: 20 }).notNull().default('queued'),
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
  uniqueDateBooth: unique('unique_date_booth').on(table.date, table.boothId),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Booth = typeof booths.$inferSelect;
export type NewBooth = typeof booths.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
