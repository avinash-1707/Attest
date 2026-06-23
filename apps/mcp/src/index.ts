#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  attestRequest,
  assertOutcomeRequest,
  verifyFlowRequest,
  explainFailureRequest,
} from '@attest/contracts';
import { loadConfig } from './config';
import { createBackendClient } from './client';
import {
  handleAttest,
  handleAssertOutcome,
  handleVerifyFlow,
  handleExplainFailure,
  type ToolDeps,
  type ToolResult,
} from './tools';

// apps/mcp: the agent-facing MCP server [arch §3.1]. A thin stdio client of apps/backend - it owns no
// execution logic [invariant 1]. It authenticates with a service key and acts on exactly one app, both
// from env (config.ts), so the agent-facing tools stay {goal,url} and never name an appId.
//
// stdout is the JSON-RPC channel: ALL diagnostics go to stderr, never console.log [MCP stdio rule].

function toContent(result: ToolResult) {
  return { content: [{ type: 'text' as const, text: result.text }], isError: result.isError };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createBackendClient({ backendUrl: config.backendUrl, serviceKey: config.serviceKey });
  const deps: ToolDeps = {
    appId: config.appId,
    client,
    runner: { pollIntervalMs: config.pollIntervalMs, pollTimeoutMs: config.pollTimeoutMs },
  };

  const server = new McpServer({ name: 'attest', version: '0.1.0' });

  server.registerTool(
    'attest',
    {
      title: 'Attest an outcome',
      description:
        'Verify a user outcome in a real browser and return an evidence-backed attestation (the verdict you loop on). Give a natural-language goal and the URL to start from.',
      inputSchema: attestRequest.shape,
    },
    async (args) => toContent(await handleAttest(args, deps)),
  );

  server.registerTool(
    'assert_outcome',
    {
      title: 'Assert a single outcome',
      description:
        'Assert that a single outcome holds at a URL. The outcome is the goal; returns an attestation.',
      inputSchema: assertOutcomeRequest.shape,
    },
    async (args) => toContent(await handleAssertOutcome(args, deps)),
  );

  server.registerTool(
    'verify_flow',
    {
      title: 'Verify an ordered flow',
      description:
        'Verify an explicit ordered sequence of steps toward a goal at a URL. Returns an attestation.',
      inputSchema: verifyFlowRequest.shape,
    },
    async (args) => toContent(await handleVerifyFlow(args, deps)),
  );

  server.registerTool(
    'explain_failure',
    {
      title: 'Explain a failure',
      description:
        'Retrieve the full failure dossier (root-cause hypothesis, console/network evidence, suggested fix) for a previously failed run, by runId.',
      inputSchema: explainFailureRequest.shape,
    },
    async (args) => toContent(await handleExplainFailure(args, deps)),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[attest-mcp] server connected on stdio\n');

  // Graceful shutdown: when the host signals, close the server (and its transport) before exit.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void server.close().finally(() => process.exit(0));
    });
  }
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  process.stderr.write(`[attest-mcp] fatal: ${message}\n`);
  process.exit(1);
});
