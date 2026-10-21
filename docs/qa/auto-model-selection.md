# QA plan: automatic model and effort selection

Contract: `packages/shared/src/agents.ts` (`ModelSelectionMode`, `RunModelChoice`), `tasks.ts` (`modelChoice`, assign `model`/`effort`).
Rule: `fixed` (default) ignores invoker choices; `auto` uses invoker choice per field, falling back to the agent's `model`/`effort`.

Automated server tests: `apps/server/test/integration/autoModelSelectionQa.test.ts`, `autoModelMigrationQa.test.ts`. Marked **[S]** below. **[W]** = web test, **[M]** = manual.

## Resolution
| # | Scenario | Expected | |
|---|---|---|---|
| 1 | Fixed agent, delegation with model/effort | Runtime gets agent model/effort; subtask `modelChoice` = null/null | S |
| 2 | Auto agent, full choice (delegate) | Runtime gets chosen model+effort; stored on subtask | S |
| 3 | Auto, only effort / only model | Chosen field used, other = agent's; missing stored as null | S |
| 4 | Auto, no choice | Agent defaults; choice null/null | S |
| 5 | Follow-up on auto task | Reuses stored choice (not agent defaults) | S |
| 6 | Follow-up on fixed task | Agent defaults | S |
| 7 | Interrupted task recovered, then follow-up | Choice kept after recovery | S |
| 8 | PM assign (HTTP) auto agent with choice | 201, DTO `modelChoice` set, runtime uses it | S |
| 9 | PM assign fixed agent with choice | 201, choice ignored (null), runtime uses agent's | S |
| 10 | PM assign with `null` model/effort | Accepted, = no choice | S |
| 11 | Switching agent fixed->auto->fixed | Only new tasks affected; old stored choices not applied to fixed | S |

## Validation
| # | Scenario | Expected | |
|---|---|---|---|
| 12 | Assign with unknown model / effort / wrong type | 400, no task created | S |
| 13 | Create/update agent with invalid `modelSelection` | 400 | S |
| 14 | Create agent without `modelSelection` | `fixed` | S |
| 15 | `delegate_task` MCP tool with invalid model/effort | Tool error, no subtask (check FleetToolServer zod schema) | M |
| 16 | Delegating with invalid value via gateway | Rejected, no subtask | S |

## Persistence / migration / portability
| # | Scenario | Expected | |
|---|---|---|---|
| 17 | Legacy DB (old schema) migrated | Agents `fixed`; tasks choice null; migration idempotent | S |
| 18 | Export includes `modelSelection` | Yes, per agent | S |
| 19 | Import old file (field missing) | Agent `fixed` | S |
| 20 | Export -> import roundtrip with auto agent | Stays `auto` | S |
| 21 | Import with invalid `modelSelection` | 400 | S |

## Briefing
| # | Scenario | Expected | |
|---|---|---|---|
| 22 | Collaborators all fixed | No auto marker / model-choice guidance in system prompt (regression: unchanged text) | S |
| 23 | A collaborator is auto | Prompt marks that collaborator as auto and explains `model`/`effort` params | S |
| 24 | `list_collaborators` | Auto marker only for auto collaborators | M (depends on `CollaboratorInfo` shape) |

## UI (web)
| # | Scenario | Expected | |
|---|---|---|---|
| 25 | Agent form toggle | Default fixed; switching to auto relabels model/effort as fallback/default; value submitted | W |
| 26 | Editing existing agent | Toggle reflects stored mode | W |
| 27 | Assign form | Model/effort selectors only when selected agent is auto; hidden for fixed; reset when switching agent; "agent default" option sends null/omits | W |
| 28 | Task detail | Shows chosen model/effort when set; nothing (or agent default) for fixed/null | W |
| 29 | Accessibility | Toggle is a labelled radio group/switch, keyboard operable, selectors have labels, visibility change doesn't lose focus; no color-only info | W/M |
| 30 | Old API payloads without `modelSelection`/`modelChoice` | UI does not crash | W |

## Regression
Full `pnpm -r test`, `pnpm -r typecheck`, lint; existing delegation/import/export tests unchanged.
