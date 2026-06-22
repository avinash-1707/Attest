import type { AgentRole } from '@attest/contracts';

// Model adapter: one OpenRouter-backed client; the model is chosen per call from RunModelConfig
// [tech-arch §3.3]. core never imports a provider SDK.

export interface ModelRequest {
  prompt: string;
  system?: string;
}

export interface ModelResponse {
  text: string;
}

export interface ModelClient {
  complete(role: AgentRole, req: ModelRequest): Promise<ModelResponse>;
}
