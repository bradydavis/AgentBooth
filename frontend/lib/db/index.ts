import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

let dbClient;

if (process.env.DATABASE_URL.includes('localhost') || process.env.NODE_ENV === 'development') {
  // Use local node-postgres for dev/localhost
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  dbClient = drizzlePg(pool, { schema });
} else {
  // Use Neon HTTP for production
  const sql = neon(process.env.DATABASE_URL);
  dbClient = drizzleNeon(sql, { schema });
}

export const db = dbClient;
export * from './schema';
