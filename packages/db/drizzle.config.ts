import { defineConfig } from 'drizzle-kit';

// Drizzle Kit: generates SQL migrations from the schema [tech-arch §10.3]. Migrations are an
// additive-first, gated deploy step ahead of rolling out backend/worker.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  casing: 'snake_case',
});
