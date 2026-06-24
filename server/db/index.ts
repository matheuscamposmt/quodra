import pkg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const { Pool } = pkg

// DATABASE_URL (or NUXT_DATABASE_URL as an explicit override) is read from the env.
const connectionString =
  process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL ?? ''

// Some hosting networks occasionally drop idle TCP connections, which then
// surface as ETIMEDOUT on the next query. keepAlive + a short idle timeout keep
// the pool healthy; connectionTimeoutMillis fails fast instead of hanging ~21s.
const pool = new Pool({
  connectionString,
  keepAlive: true,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

// A pool-level error on an idle client must not crash the server process.
pool.on('error', (err) => console.error('[db] idle pool client error', err))

export const db = drizzle(pool, { schema })

/** Runs a read with one retry on transient connection errors (network blips). */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    const transient = e?.code === 'ETIMEDOUT' || e?.code === 'ECONNREFUSED' || e?.code === 'ECONNRESET'
    if (!transient) throw e
    return await fn()
  }
}

// Greenfield SaaS DB → a single idempotent bootstrap is simpler than a migration
// tool (YAGNI). Runs once at server boot from a Nitro plugin (not on first
// request, so the schema is guaranteed present before any handler runs).
let bootstrapped: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  // Memoize success only — if bootstrap fails (e.g. a transient connect timeout
  // at cold boot), clear the memo so the next caller retries instead of being
  // stuck with a rejected promise forever (which left new columns unmigrated).
  if (!bootstrapped) {
    bootstrapped = bootstrap().catch((e) => {
      bootstrapped = null
      throw e
    })
  }
  return bootstrapped
}

async function bootstrap(): Promise<void> {
  await withRetry(() => pool.query(`
    CREATE TABLE IF NOT EXISTS share_links (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug            text UNIQUE NOT NULL,
      project_id      text NOT NULL,
      project_name    text,
      password_hash   text,
      label           text,
      is_public       boolean NOT NULL DEFAULT false,
      triage_enabled  boolean NOT NULL DEFAULT true,
      triage_team_id  text,
      active          boolean NOT NULL DEFAULT true,
      created_at      timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hidden_labels        text;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hidden_statuses      text;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hide_estimate        boolean NOT NULL DEFAULT false;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hide_assignee        boolean NOT NULL DEFAULT false;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hide_due_date        boolean NOT NULL DEFAULT false;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS hide_priority        boolean NOT NULL DEFAULT false;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS show_project_updates boolean NOT NULL DEFAULT true;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS client_name          text;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS client_logo_url      text;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS view_count           integer NOT NULL DEFAULT 0;
    ALTER TABLE share_links ADD COLUMN IF NOT EXISTS last_viewed_at       timestamptz;
  `))
}
