# @attest/mcp

The MCP server an agent runs locally. A thin stdio Model Context Protocol server that exposes the Attest QA primitive as tools and forwards each call to the hosted [backend](../backend) over a service key. It holds no engine and no browser; it is an authenticated client to the one execution path. One server instance is bound to one app.

Published as the `attest-mcp` binary.

## Contents

- [Tools](#tools)
- [Result semantics](#result-semantics)
- [How a tool call runs](#how-a-tool-call-runs)
- [Layout](#layout)
- [Run](#run)
- [Configuration](#configuration)
- [Boundaries](#boundaries)

## Tools

The three run tools all resolve to the same backend run (`{ appId, goal, url }`). They are agent-ergonomic framings of one goal string, not separate execution paths.

| Tool | Input | Behavior |
| ---- | ----- | -------- |
| `attest` | `{ goal, url }` | Verify a goal against a URL; return the attestation. |
| `assert_outcome` | `{ url, outcome }` | The asserted `outcome` becomes the goal. |
| `verify_flow` | `{ url, goal, steps[] }` | The steps are numbered and folded into the goal text the planner reads. |
| `explain_failure` | `{ runId }` | A read: returns the failure dossier of an existing attestation, or a null failure if the run did not fail. |

`verify_flow` composes its goal as the original goal followed by `Steps to verify, in order:` and the numbered steps, so the planner treats them as part of one goal.

## Result semantics

A tool result is a JSON string plus an `isError` flag.

- A `passed`, `failed`, or `inconclusive` verdict is a **successful** tool call (`isError: false`). The agent is meant to loop on the verdict.
- `isError: true` is reserved for operational faults where no attestation exists: `run_canceled`, `run_timeout`, or `backend_error` (with the HTTP status and backend code attached).

A contract-validation failure (the backend returned a shape that does not parse) is thrown, which the MCP SDK surfaces as a protocol error rather than a tool result.

## How a tool call runs

`src/backend/runner.ts` (`runAndAwait`):

1. `POST /runs` via the backend client → get a `runId`.
2. Poll `GET /runs/:id` on an interval until the lifecycle is `completed` (fetch and return the attestation) or `canceled`.
3. The wall-clock budget is `pollTimeoutMs`; the number of polls is `ceil(timeout / interval)`, with no sleep after the final poll so the real wait never overshoots the budget.
4. If the budget is exhausted, return a `timeout` outcome.

The backend client (`src/backend/client.ts`) sends the service key as `Authorization: Bearer <key>`, validates every response against `@attest/contracts`, and throws `BackendError(status, code, message)` on a non-OK response.

## Layout

```
src/
  index.ts           MCP server bootstrap + tool registration; stdio transport; graceful shutdown
  config.ts          environment parsing
  tools/tools.ts     the tool surface; composes goals, shapes results
  backend/client.ts  typed HTTP client to the backend
  backend/runner.ts  trigger a run and poll to completion
```

All diagnostics go to stderr; stdout is the JSON-RPC channel.

## Run

```bash
pnpm --filter @attest/mcp build
pnpm --filter @attest/mcp start            # node dist/index.js
```

Wire `attest-mcp` into an MCP-capable agent as a stdio command.

## Configuration

Read from the environment at startup (`src/config.ts`):

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `ATTEST_BACKEND_URL` | yes | (none) | Backend base URL. |
| `ATTEST_SERVICE_KEY` | yes | (none) | Org-scoped service key (Bearer token). |
| `ATTEST_APP_ID` | yes | (none) | The app this server targets. |
| `ATTEST_POLL_INTERVAL_MS` | no | 2000 | Sleep between status polls. |
| `ATTEST_POLL_TIMEOUT_MS` | no | 180000 | Total wait budget before a timeout result. |

## Boundaries

- Depends only on `@attest/contracts` and the MCP SDK. No database, engine, or browser.
- Every request and response is validated against `@attest/contracts`, the same shapes the backend and worker enforce.
- The service key scopes the server to one org and a set of apps; the backend rejects any run outside that scope.
