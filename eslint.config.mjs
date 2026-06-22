import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ENGINE_LIBS = [
  'puppeteer',
  'puppeteer-core',
  'stagehand',
  '@browserbasehq/stagehand',
  'openai',
  '@anthropic-ai/*',
];

const TRANSPORT_LIBS = [
  'fastify',
  'bullmq',
  'ioredis',
  'next',
  'next/*',
  '@modelcontextprotocol/*',
];

const APP_PACKAGES = [
  '@attest/web',
  '@attest/dashboard',
  '@attest/backend',
  '@attest/worker',
  '@attest/mcp',
];

const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/.turbo/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // packages/contracts depends on nothing but zod [tech-arch §1.2 rule 1]
  {
    files: ['packages/contracts/src/**/*.ts'],
    rules: restrict([
      { group: ['@attest/*'], message: 'contracts is the root of the graph; it imports nothing but zod.' },
      { group: [...ENGINE_LIBS, ...TRANSPORT_LIBS], message: 'contracts must stay dependency-free (zod only).' },
    ]),
  },

  // packages/core: transport-free, storage-free; contracts only [tech-arch §1.2 rule 2]
  {
    files: ['packages/core/src/**/*.ts'],
    rules: restrict([
      { group: ['@attest/db', '@attest/db/*'], message: 'core is storage-free; it must not import db.' },
      { group: [...APP_PACKAGES], message: 'core must not import an app.' },
      { group: [...TRANSPORT_LIBS], message: 'core is transport-free; no HTTP, queue, or MCP imports.' },
    ]),
  },

  // engine libs live ONLY inside core/adapters/* implementations [tech-arch §1.2 rule 6]
  {
    files: [
      'packages/core/src/planner/**/*.ts',
      'packages/core/src/executor/**/*.ts',
      'packages/core/src/judge/**/*.ts',
      'packages/core/src/evidence/**/*.ts',
    ],
    rules: restrict([
      { group: [...ENGINE_LIBS], message: 'Engine SDKs belong only inside core/adapters/* implementations.' },
    ]),
  },

  // packages/db: contracts only; never core or an app [tech-arch §1.2 rule 3]
  {
    files: ['packages/db/src/**/*.ts'],
    rules: restrict([
      { group: ['@attest/core', '@attest/core/*'], message: 'db must not import core.' },
      { group: [...APP_PACKAGES], message: 'db must not import an app.' },
    ]),
  },

  // apps never import each other [tech-arch §1.2 rule 4]; ee only via interface seam [rule 5]
  {
    files: ['apps/*/src/**/*.ts'],
    rules: restrict([
      { group: [...APP_PACKAGES.map((p) => `${p}`), ...APP_PACKAGES.map((p) => `${p}/*`)], message: 'apps must not import each other; talk over the network boundary.' },
      { group: ['@attest/ee', '@attest/ee/*'], message: 'ee is wired in only behind an interface seam, never imported directly.' },
    ]),
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
