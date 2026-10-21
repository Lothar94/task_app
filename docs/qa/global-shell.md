# QA — global shell (⌘K search, notification bell, fleet status bar)

Branch `test/global-shell-validation`. Verdict: **PASS with 1 minor defect** (pre-existing, outside the shell).

## Acceptance criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| a | Server-side search endpoint (avoids downloading all tasks of every project to filter in the client) | Server search tests (incl. QA suite) green; web `useGlobalSearch` queries the endpoint, no client-side task fan-out | Pass |
| b | Notifications fed by existing SSE events (`/api/events?organizationId=`) | `useOrganizationEvents` / `NotificationCenter` / `notificationModel` / `notificationStorage` tests (incl. `*Qa.test`) green | Pass |
| c | Accessible combobox ARIA pattern | Real DOM: `role=combobox`, `aria-expanded`, `aria-controls`, `aria-autocomplete=list`, `aria-keyshortcuts`, `role=listbox` with groups; bell has `aria-expanded`/`aria-controls`; footer `role=status`. Covered by `GlobalSearchQa.test.tsx` | Pass |
| d | No horizontal scroll on mobile | Table below (real Chromium 1217 via Playwright 1.64.1, seeded DB) | **Fail at 320px on /projects only (D-1, not shell)**; Pass elsewhere |
| e | Server and web tests | `env -u BASH_MAX_OUTPUT_LENGTH pnpm -r test`: server 520 tests / 47 files pass; web 436 pass + 1 expected fail (437) / 53 files | Pass |

## Mobile measurements (`scrollWidth` of html / body vs `innerWidth`)

States: idle, search open with query `a` (Ctrl+K on desktop, search icon on mobile), bell panel open.
Footer visible (bottom ≤ viewport) and popover boxes inside viewport in **all** 18 cases.

| Viewport | Page | idle | search open | bell open | Result |
|---|---|---|---|---|---|
| 320x640 | /projects | 327 | 327 | 327 | **FAIL (+7px)** |
| 320x640 | /agents | 320 | 320 | 320 | ok |
| 375x812 | /projects | 375 | 375 | 375 | ok |
| 375x812 | /agents | 375 | 375 | 375 | ok |
| 1280x800 | /projects | 1280 | 1280 | 1280 | ok |
| 1280x800 | /agents | 1280 | 1280 | 1280 | ok |

Popover boxes (left–right): search 320 → 9–311; 375 → 9–366; 1280 → 584–1030. Bell 320 → 8–312; 375 → 15–367; 1280 → 719–1071. Footer 32px tall, flush to bottom.

## Defects

**D-1 (minor) — /projects overflows 7px horizontally at 320px.**
- File: `apps/web/src/components/Tabs.tsx:37` (`inline-flex` tablist, no wrap/shrink), rendered inside `<main>` on the projects page.
- Repro: open `/projects` at 320x640 → `documentElement.scrollWidth` = 327 > 320. Tablist right edge = 327, last tab button 324.
- Expected: scrollWidth ≤ 320. Actual: 327, in every shell state.
- Not caused by the shell: `Tabs.tsx` is unchanged versus `master`; overflow is present with the shell idle. Header/footer/popovers do not overflow. Not fixed (QA scope).

## Known limitations

- Notifications only come from SSE events received while the app is open; nothing is backfilled on load.
- Notifications are not synced between browser tabs.

## Gaps / assumptions

- Only /projects and /agents measured; seeded DB had agents only (no projects/tasks), so search results were empty-state boxes (heights are smaller than with real results; width bounds are unaffected).
- Chromium only; Playwright 1.64.1 was run with the cached chromium-1217 binary (revision mismatch, worked).
- Only 320/375/1280 widths; no 768–1024 tablet check.
