CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"name" varchar(100),
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"booth_type" varchar(20) NOT NULL,
	"twilio_number" varchar(20),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booth_id" uuid,
	"agent_id" varchar(255) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"twilio_call_sid" varchar(100),
	"duration" integer,
	"cost" numeric(10, 4),
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"transcript_url" text,
	"recording_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"amount" numeric(10, 4) NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"description" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"booth_id" uuid,
	"total_calls" integer DEFAULT 0,
	"total_duration" integer DEFAULT 0,
	"total_cost" numeric(10, 4) DEFAULT '0',
	"avg_duration" integer,
	"avg_queue_wait" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_date_booth" UNIQUE("date","booth_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"plan_id" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_user_id" ON "api_keys" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_hash" ON "api_keys" ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booths_user_id" ON "booths" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booths_twilio_number" ON "booths" ("twilio_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calls_booth_id" ON "calls" ("booth_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calls_agent_id" ON "calls" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calls_phone_number" ON "calls" ("phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calls_started_at" ON "calls" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calls_status" ON "calls" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credits_user_id" ON "credits" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credits_created_at" ON "credits" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_stats_date" ON "daily_stats" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_daily_stats_booth_id" ON "daily_stats" ("booth_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id" ON "subscriptions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_stripe_id" ON "subscriptions" ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_clerk_id" ON "users" ("clerk_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booths" ADD CONSTRAINT "booths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calls" ADD CONSTRAINT "calls_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credits" ADD CONSTRAINT "credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
