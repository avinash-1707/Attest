import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = ReturnType<typeof drizzle<Schema>>;

// Long-lived pooled connection for the Fastify backend and the worker. The tenant-scoped
// data-access layer wraps this; no call site issues an un-org-scoped query [arch §5.2, invariant 3].
let pool: Pool | undefined;
let database: Database | undefined;

export function getDb(connectionString = process.env.DATABASE_URL): Database {
  if (!database) {
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new Pool({ connectionString });
    database = drizzle(pool, { schema });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
