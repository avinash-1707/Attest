// packages/db: Drizzle schema, migrations, tenant-scoped data access [arch §5, tech-arch §1.2].
// Every table carries org_id; all access goes through the tenant-scoped layer (Next up: DAL unit).
export * as schema from './schema';
export * from './schema';
export * from './client';
export * from './dal';
export * from './secrets';
