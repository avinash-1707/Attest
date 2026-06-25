# @attest/mcp

The MCP server an agent runs locally. It exposes the Attest QA primitive as Model Context Protocol tools and forwards each call to the hosted [backend](../backend) over an org-scoped key. It holds no engine and no browser; it is a thin, authenticated client to the one execution path.

Published as the `attest-mcp` binary.

## Tools

All of the run tools resolve to the same backend run (`{ appId, goal, url }`). They are agent-ergonomic framings of one goal string, not separate execution paths:

- **`attest`**: verify a goal against a URL and return the attestation.
- **`assert_outcome`**: the asserted outcome is the goal.
- **`verify_flow`**: a goal plus an ordered list of steps to exercise; the steps are folded into the goal text the planner reads.
- **`explain_failure`**: a read against an existing attestation.

A `failed` or `inconclusive` verdict is a **successful** tool call: the agent is meant to loop on the verdict. The `isError` flag is reserved for operational faults (run canceled, poll timeout, backend error) where no attestation exists.

## Layout

```
src/
  index.ts           MCP server bootstrap and tool registration
  config.ts          app id + backend key + endpoint
  tools/tools.ts     the tool surface; composes goals and shapes results
  backend/client.ts  HTTP client to the backend
  backend/runner.ts  trigger a run and poll to completion
```

## Run

```bash
pnpm --filter @attest/mcp build
pnpm --filter @attest/mcp start          # node dist/index.js
```

Wire it into an MCP-capable agent as the `attest-mcp` command. It authenticates to the backend with an org-scoped app key and targets a single app id.

## Configuration

Needs the backend URL, an org-scoped app key, and the target app id. These are read from the environment at startup (see `src/config.ts`).

## Boundaries

- Depends only on `@attest/contracts` and the MCP SDK. No database, no engine, no browser.
- Every request and response is validated against `@attest/contracts`, the same shapes the backend and worker enforce.
