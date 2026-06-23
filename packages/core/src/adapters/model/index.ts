import type { AgentRole } from '@attest/contracts';

// Model adapter: one OpenRouter-backed client; the model is chosen per call from RunModelConfig
// [tech-arch §3.3]. core never imports a provider SDK.

export interface ModelRequest {
  prompt: string;
  system?: string;
}

export interface ModelResponse {
  text: string;
  // USD cost of this completion as reported by the gateway (OpenRouter `usage.cost`), when available.
  // Absent for fakes or gateways that don't report it; the run meter treats absent as 0 [tech-arch §13.2].
  costUsd?: number;
}

export interface ModelClient {
  complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse>;
}
