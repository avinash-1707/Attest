'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  RunStatusView,
  AppCreate,
  AppUpdate,
  AppKeyCreate,
  ModelKeyCreate,
  AppCredentialCreate,
  CheckoutCreate,
} from '@attest/contracts';
import { api, uploadAvatar } from './api';
import { authClient, updateUser } from './auth-client';
import { downscaleImage } from './image';
import { qk } from './query-keys';

// Profile update input. file is the downscaled webp blob; omit to keep the current avatar.
// removePhoto:true clears the avatar from the session (passes image:null to updateUser).
export interface UpdateProfileInput {
  name: string;
  file?: Blob | null;
  removePhoto?: boolean;
}

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

// --- Billing (hosted tier) ---
export function useBillingSummary() {
  return useQuery({ queryKey: qk.billing, queryFn: api.getBillingSummary });
}

// Checkout + portal both return a hosted URL the caller redirects the browser to. We do NOT cache it
// (it is single-use / short-lived); the component navigates on success.
export function useCheckout() {
  return useMutation({ mutationFn: (input: CheckoutCreate) => api.createCheckout(input) });
}

export function useBillingPortal() {
  return useMutation({ mutationFn: () => api.getBillingPortal() });
}

// --- Profile ---

// Orchestrates: downscale -> upload avatar (if a new file is provided) -> updateUser.
// Upload-then-updateUser is the only partial-safe order: a failed updateUser leaves the blob
// stored but unlinked; a failed upload leaves the existing image in place.
// On success, refetches the better-auth session so useSession reflects the new name/image.
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      let imageUrl: string | null | undefined;

      if (input.removePhoto) {
        imageUrl = null;
      } else if (input.file) {
        const scaled = await downscaleImage(input.file instanceof File ? input.file : new File([input.file], 'avatar'));
        const { image } = await uploadAvatar(scaled);
        imageUrl = image;
      }

      await updateUser({
        name: input.name,
        ...(imageUrl !== undefined ? { image: imageUrl } : {}),
      });

      // Bust better-auth's session cache so useSession gets the fresh name+image immediately.
      await authClient.getSession({ query: { disableCookieCache: true } });
    },
  });
}
