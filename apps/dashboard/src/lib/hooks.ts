'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RunStatusView,
  AppCreate,
  AppUpdate,
  AppKeyCreate,
  ModelKeyCreate,
  AppCredentialCreate,
} from '@attest/contracts';
import { api } from './api';
import { qk } from './query-keys';

// Typed React Query hooks over api.ts. Reads are useQuery; every mutation invalidates the list it
// affects so the UI stays consistent without manual cache surgery. These are the seams the (canvas-
// built) pages consume - the components hold no fetch logic of their own [arch §3.2].

// --- Runs ---
export function useRuns() {
  return useQuery({ queryKey: qk.runs, queryFn: api.listRuns });
}

// Live-watch: while a run is queued/running, poll its status; stop once it resolves.
const TERMINAL = new Set(['completed', 'canceled']);
export function useRun(id: string, opts: { live?: boolean } = {}) {
  return useQuery({
    queryKey: qk.run(id),
    queryFn: () => api.getRun(id),
    refetchInterval: (query) => {
      if (!opts.live) return false;
      const data = query.state.data as RunStatusView | undefined;
      // Poll every 2s until the run resolves. Before the first fetch lands (data undefined) this arms
      // polling too, since TERMINAL.has(undefined) is false.
      return data && TERMINAL.has(data.lifecycle) ? false : 2000;
    },
  });
}

export function useAttestation(id: string, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: qk.attestation(id), queryFn: () => api.getAttestation(id), enabled: opts.enabled ?? true });
}

export function useEvidence(id: string, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: qk.evidence(id), queryFn: () => api.listEvidence(id), enabled: opts.enabled ?? true });
}

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.runs }),
  });
}

// --- Apps ---
export function useApps() {
  return useQuery({ queryKey: qk.apps, queryFn: api.listApps });
}

export function useCreateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppCreate) => api.createApp(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apps }),
  });
}

export function useUpdateApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AppUpdate }) => api.updateApp(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apps }),
  });
}

export function useDeleteApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteApp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.apps }),
  });
}

// --- Service keys ---
export function useKeys() {
  return useQuery({ queryKey: qk.keys, queryFn: api.listKeys });
}

// The result carries the plaintext key exactly once; the caller must surface it immediately and not
// persist it [arch §6.2]. We deliberately do NOT write it into the query cache.
export function useCreateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppKeyCreate) => api.createKey(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.keys }),
  });
}

export function useRevokeKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.keys }),
  });
}

// --- BYOK model keys ---
export function useModelKeys() {
  return useQuery({ queryKey: qk.modelKeys, queryFn: api.listModelKeys });
}

export function useCreateModelKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ModelKeyCreate) => api.createModelKey(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.modelKeys }),
  });
}

export function useDeleteModelKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteModelKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.modelKeys }),
  });
}

// --- App login credentials ---
export function useCredentials(appId?: string) {
  return useQuery({ queryKey: qk.credentials(appId), queryFn: () => api.listCredentials(appId) });
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppCredentialCreate) => api.createCredential(input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.credentials() });
      void qc.invalidateQueries({ queryKey: qk.credentials(vars.appId) });
    },
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCredential(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.credentials() }),
  });
}
