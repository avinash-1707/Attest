import { defineConfig } from 'vitest/config';

// Root fallback for packages with no tests yet. Each package with tests has its own
// vitest.config.ts (nearest config wins), so tests run scoped to that package.
export default defineConfig({
  test: {
    include: [],
    passWithNoTests: true,
  },
});
