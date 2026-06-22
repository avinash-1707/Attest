import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '../schema';

// Driver-agnostic drizzle handle: satisfied by node-postgres (prod) and pglite (tests) alike.
// Typing the DAL against the base keeps the data layer free of any one driver [arch §5].
export type Db = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
