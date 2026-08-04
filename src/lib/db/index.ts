import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Connection string from .env.local; use transaction pooler URL for serverless (port 6543)
// and direct URL (port 5432) for migrations via drizzle-kit
const connectionString = process.env.DATABASE_URL!

// Disable prefetch for serverless (transaction mode pooler doesn't support it)
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })

export type DB = typeof db
