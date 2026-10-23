# QA: agent live org chart + editable sheet (task 63 / QA task 98)

Branch `test/agent-live-sheet-qa` (from `feature/agent-live-sheet`). Author: Vega (QA).

## Summary

**Verdict: PASS. No functional defects found** (3 minor observations below, none blocking).

Commands run (in the worktree):

- `pnpm typecheck`: OK.
- `env -u BASH_MAX_OUTPUT_LENGTH pnpm test`: server 68 files / 762 tests pass; web 71 files / 549 pass + 1 expected-fail (pre-existing `it.fails` in `ProjectMembers.test.tsx`, unrelated).
- `pnpm lint`: 0 errors, 2 pre-existing warnings (`createContainer` length, `ProjectsPage` complexity), none in new files.
- Baseline before my tests: server 721, web 541. **Added: 41 server tests, 8 web tests.**
- Manual smoke against a real server (`tsx src/main/server.ts`, port 4310, temp `DATABASE_PATH`, `MONTHLY_BUDGET_USD=25.5`, `CLAUDE_USER_CONFIG_FILE` fixture with secrets). Server stopped by PID afterwards.

New tests:

- `apps/server/test/integration/agentLiveSheetQa.test.ts` (settings validation and boundaries, round-trip, disabled agents, SSE, MCP secrecy).
- `apps/web/src/features/agents/AgentsLiveSheetQa.test.tsx` (reduced motion, chip, zoom, over-limit tile, sheet save payload, disable failure).

## Criteria matrix

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | New fields persist and validate | **Pass** | Cap 1 and 128000 accepted; 0, -1, 128001, 1.5, 1e9, `"100"`, `true`, `[]` → 400 (create and update; update leaves the stored agent unchanged). Temperature 0 and 1 accepted when supported; `"0.5"`, `true`, `[0.5]`, 2, -1 → 400; non-null temperature with an unsupporting runtime → 400 (existing + smoke). MCP: 20 accepted, 21 → 400; duplicates and padding collapse (a 25+ list of repeats is valid); `a.b`, `a:b`, `a/b`, `a b`, `ñandú`, 65 chars, numbers, null, nested arrays → 400; 64 chars OK. Omitted fields default to `null, null, []`. Round-trip export/import into another organization keeps all three; an import with an invalid agent is rejected as a whole. |
| 2 | Disabled agent cannot get new tasks | **Pass** | Create task (also as draft) → 409 and nothing created; reassign → 409 (existing); delegate → error "is disabled" and no run for it; propose → ConflictError (existing); not listed in `listCollaborators`; re-enable restores task creation, listing and delegation; disable/enable idempotent; running task finishes after disabling; draft tasks remain editable (existing); saving the sheet via `PUT /api/agents/:id` keeps `enabled=false`. Smoke: 409 `"Dev" is disabled and cannot receive new tasks`. |
| 3 | Live state via SSE | **Pass** | Delegation scenario (CTO delegating, Dev working): the snapshot with `state`, `currentTask` and `delegations` reaches unfiltered and `organizationId=ORG` streams. It does not reach `organizationId=<other org>`, nor `projectId=…` (with or without `organizationId`). The final snapshot is `agents: []` after cancel. Coalescing on the wire: fewer snapshots than `task.*` events. Smoke with curl -N: `task.created` produced one `agent.activity` on the org and unfiltered streams and none on the project stream. |
| 4 | MCP catalog never exposes launch config | **Pass** | `ClaudeUserMcpServers` over HTTP with a fixture containing command/args/env/url/headers/secrets: `/api/agent-runtime` returns only `{name, transport}`; the secret strings are absent from runtime, agent DTO and export bodies. Smoke on the real server: 0 secret matches in `/agent-runtime`, `/agents` and export. |
| 5 | Budget | **Pass** | Month-to-date cost and limit (existing + smoke: `{"month":"2026-10","monthToDateCostUsd":0,"monthlyLimitUsd":25.5}`); no limit → `null`; other organization's runs not counted; unknown org → 404. Invalid `MONTHLY_BUDGET_USD` (`0`, `-10`, `abc`, `Infinity` in unit tests; `abc` on the real server) → startup aborts with an error mentioning the variable (process exit 1). |
| 6 | Web | **Pass** | Temperature/cap disabled with hint when unsupported; save sends the full `AgentInput` and sends `null` for unsupported settings even if the agent had stored values (new); disable asks for confirmation, enable does not, a failing disable shows the error and no success notice (new); "EN CURSO" chips in the diagram (new, page level); no `animate-*` class outside `motion-safe:` in list, diagram and dual views with busy agents (new, DOM scan); zoom + / − / fit via buttons on the page and via keys (new + existing); dual view and persisted choice; tiles incl. over-limit "superado" (new). |

Smoke limit: no real Claude run was started (would cost money and needs credentials), so `working`/`delegating` states over a real HTTP server were verified only with the fake runtime in integration tests. The curl smoke covered the SSE filtering with a draft task (`task.created` → empty `agent.activity`).

## Defects

None.

## Observations (not defects)

1. **MCP names are not validated against the catalog.** The server accepts any well-formed name (e.g. `srv-0`) even if the catalog is empty. The web sheet flags those as unavailable, and the contract only requires name validity. Suggest confirming this is intended.
2. **Blank MCP names are dropped silently** (`" "` → removed, no 400). Harmless; documented behaviour of normalisation.
3. **Live + disabled agent in the diagram.** `AgentNode.tsx` `frameClass` gives priority to `live`, so a disabled agent that is still finishing a task loses the dashed/dimmed frame (the "Desactivado" label is still rendered). Not verified visually; low impact.

## Gaps and risks

- No browser-level check: reduced motion is verified by class inspection (`motion-safe:` variants), not by emulating `prefers-reduced-motion`. The `animate-march` keyframes live in `index.css`.
- Month boundary of the budget (runs finished last month excluded) relies on the existing `GetBudget` unit test; no clock injection in the integration fleet.
- The SSE coalescing window is tested only with 40 ms; production default not exercised.
- The pre-existing expected-fail in `ProjectMembers.test.tsx` (roving tabindex) is outside this feature.
