// Centralized query keys so reads and the mutations that invalidate them never drift apart.
export const qk = {
  runs: ['runs'] as const,
  run: (id: string) => ['runs', id] as const,
  attestation: (id: string) => ['runs', id, 'attestation'] as const,
  evidence: (id: string) => ['runs', id, 'evidence'] as const,
  apps: ['apps'] as const,
  keys: ['keys'] as const,
  modelKeys: ['model-keys'] as const,
  credentials: (appId?: string) => (appId ? (['credentials', appId] as const) : (['credentials'] as const)),
};
