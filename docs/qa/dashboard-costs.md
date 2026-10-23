# QA — dashboard costs, cache savings, deltas, error causes, retry, CSV export

Branch `test/dashboard-costs-qa` (from `feature/dashboard-costs`). Verdict: **PASS with 1 minor defect and 1 observation**.

## Acceptance criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Price table configurable on server | Defaults: opus 5/25, sonnet 3/15, haiku 1/5. `MODEL_PRICING_FILE` override merged over defaults (live server: sonnet 4/20 applied, opus stayed default). Invalid file (bad JSON, missing file, negative/missing prices) makes `pnpm start` exit with `Invalid MODEL_PRICING_FILE "<path>": <reason>` | Pass |
| 2 | Contract in `packages/shared` | `grep` for `interface/type DashboardDto, DashboardTotals, ModelUsageRow, RunErrorRow, AgentUsageRow, DailyActivity, CostBreakdown, ModelPricing` in `apps/` finds no definitions; server and web import from `@fleet/shared` | Pass |
| 3 | Charts use `--series-*` only | `features/dashboard` has no hex/rgb/hsl/oklch and no `--usage-*`; only `var(--series-1..4)` (defined in `index.css` for both themes) | Pass |
| 4 | Tests, typecheck, lint | `pnpm test`: server 623 (+4 added) / web 497 + 1 expected fail; `pnpm -r typecheck` clean; `pnpm lint` 0 errors, 2 pre-existing warnings (`container.ts:215`, `ProjectsPage.tsx:35`) | Pass |
| 5 | Manual API checks | See below | Pass |
| 6 | Edge cases | See below | Pass |

## Manual API checks (server on :4318, temp DB, `MODEL_PRICING_FILE` sonnet 4/20/5/0.4)

- Cost math (all projects, days=7): sonnet run 1M in / 200k out / 400k cache write / 3M cache read = 4 + 4 + 2 + 1.2 = 11.2; second sonnet run (500k/100k/0/1M) = 4.4; row total 15.6 (server 15.6). Opus 10k/2k at default 5/25 = 0.10. Haiku 2M in = 2.00. Total 18.47 = 15.6 + 0.1 + 2 + 0.77 (server 18.47). Cache savings 4M x (4 - 0.4) = 14.4 (server 14.4).
- Unpriced model `mystery-model`: `pricing: null`, cost breakdown zero, SDK cost 0.77 kept in `costUsd`, savings 0.
- `days=1`: `activityGranularity: "hour"`, 24 buckets; `previous` = 24–48 h window (cost 4.40, 1 run, savings 3.6, hand-checked). `days=7` previous is empty (all zeros, `successRate: null`).
- All time (no `days`): `previous: null`, daily buckets.
- Filters: `projectId` of a project in another organization -> 404; `projectId=nope` -> 404; valid project narrows totals (14.07), models and errors. `days=0|-1|1.5|abc|100000` -> 400.
- Empty organization with `days=1`: zero totals, `byModel=[]`, `errors=[]`, `errorsTotal=0`, 24 hourly buckets, `previous.successRate=null`.
- Error causes: `429 rate limit` -> rate_limit, `usage limit reached` -> session_limit, `Interrupted by user` -> interrupted. `retryable` true for failed root tasks, false for the failed subtask.
- Retry: failed root task -> 200 (task re-queued, then picked up and finished by the agent); completed root -> 409; failed subtask -> 409; unknown id -> 404. Retry on an archived project not verified live: archiving was refused with 409 because tasks were running.
- Retry caveat: the live server uses the real Claude runtime, so the two retried tasks really ran a (tiny) agent in empty temp workspaces.

## Edge cases / CSV

`errorsToCsv` (web unit tests, re-read): commas, quotes (`""`), `\n`, `\r\n` quoted; leading `= + - @ \t \r` prefixed with `'`; CRLF rows; header-only for empty input. Pass.

## Defects

**D-1 (minor) — hourly chart drops runs from the oldest partial hour.** Fixed: `hourlyBuckets` folds the partial hour into the first bucket (`test/unit/activityBuckets.test.ts`).
- File: `apps/server/src/application/metrics/activityBuckets.ts:24` (`hourlyBuckets`) vs window start in `buildDashboard.ts:periodOf` (`now - 24h`).
- Repro: `now = 13:30`; first bucket is `2026-10-20T14:00`; a run finished 23.8 h ago (`13:42` the day before) is inside the 24 h totals but `keyOf` gives `…T13:00`, which is not a bucket, so the chart omits it (`b.keys.includes(key) === false`).
- Expected: chart tokens/outcomes sum to the totals for the period. Actual: up to 59 min of activity counted in totals but absent from the chart.

## Observations (not defects)

- O-1: CSV export covers the listed errors (max 50, `errorsTotal` may be larger); the title shows `errorsTotal`. Confirm that is intended.
- O-2: `createTestFleet` has no `modelPrices` option, so HTTP-level pricing tests build the container by hand.

## Tests added

`apps/server/test/integration/dashboardPricingQa.test.ts` (4 tests): HTTP dashboard with default prices, with a `MODEL_PRICING_FILE` override (cost, cache savings, hourly 24 buckets, previous), all-time `previous: null`, invalid file rejected.

## Commands

`pnpm test`, `pnpm -r typecheck`, `pnpm lint`, `pnpm seed` (temp DB), server on `PORT=4318` with `curl`, direct inserts into the temp SQLite DB for runs, `tsx` script for D-1. Server stopped via its saved PID.

## Not verified

Browser rendering (tiles, deltas, dialog, 24h selector) was only checked through the existing web unit tests, not in a real browser.
