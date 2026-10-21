# QA plan: automatic model and effort selection

Contract: `packages/shared/src/agents.ts` (`ModelSelectionMode`, `RunModelChoice`), `tasks.ts` (`modelChoice`, assign `model`/`effort`).
Rule: `fixed` (default) ignores invoker choices; `auto` uses invoker choice per field, falling back to the agent's `model`/`effort`.

Automated server tests: `apps/server/test/integration/autoModelSelectionQa.test.ts`, `autoModelMigrationQa.test.ts`. Marked **[S]** below. **[W]** = web test, **[M]** = manual.

## Resolution
| # | Scenario | Expected | | Result |
|---|---|---|---|---|
| 1 | Fixed agent, delegation with model/effort | Runtime gets agent model/effort; subtask `modelChoice` = null/null | S | Pass |
| 2 | Auto agent, full choice (delegate) | Runtime gets chosen model+effort; stored on subtask | S | Pass |
| 3 | Auto, only effort / only model | Chosen field used, other = agent's; missing stored as null | S | Pass |
| 4 | Auto, no choice | Agent defaults; choice null/null | S | Pass |
| 5 | Follow-up on auto task | Reuses stored choice (not agent defaults) | S | Pass |
| 6 | Follow-up on fixed task | Agent defaults | S | Pass |
| 7 | Interrupted task recovered, then follow-up | Choice kept after recovery | S | Pass |
| 8 | PM assign (HTTP) auto agent with choice | 201, DTO `modelChoice` set, runtime uses it | S | Pass |
| 9 | PM assign fixed agent with choice | 201, choice ignored (null), runtime uses agent's | S | Pass |
| 10 | PM assign with `null` model/effort | Accepted, = no choice | S | Pass |
| 11 | Switching agent fixed->auto->fixed | Only new tasks affected; old stored choices not applied to fixed | S | Pass |

## Validation
| # | Scenario | Expected | | Result |
|---|---|---|---|---|
| 12 | Assign with unknown model / effort / wrong type | 400, no task created | S | Pass |
| 13 | Create/update agent with invalid `modelSelection` | 400 | S | Pass |
| 14 | Create agent without `modelSelection` | `fixed` | S | Pass |
| 15 | `delegate_task` MCP tool with invalid model/effort | Tool error, no subtask (check FleetToolServer zod schema) | M | Pass (autoModelToolsQa: schema enums rejected by zod; handler error → isError) |
| 16 | Delegating with invalid value via gateway | Rejected, no subtask | S | **FAIL** D1 (fix in progress on fix/auto-model-choice-validation) |

## Persistence / migration / portability
| # | Scenario | Expected | | Result |
|---|---|---|---|---|
| 17 | Legacy DB (old schema) migrated | Agents `fixed`; tasks choice null; migration idempotent | S | Pass |
| 18 | Export includes `modelSelection` | Yes, per agent | S | Pass |
| 19 | Import old file (field missing) | Agent `fixed` | S | Pass |
| 20 | Export -> import roundtrip with auto agent | Stays `auto` | S | Pass |
| 21 | Import with invalid `modelSelection` | 400 | S | Pass |

## Briefing
| # | Scenario | Expected | | Result |
|---|---|---|---|---|
| 22 | Collaborators all fixed | No auto marker / model-choice guidance in system prompt (regression: unchanged text) | S | Pass |
| 23 | A collaborator is auto | Prompt marks that collaborator as auto and explains `model`/`effort` params | S | Pass |
| 24 | `list_collaborators` | Auto marker only for auto collaborators | M (depends on `CollaboratorInfo` shape) | Pass (autoModelToolsQa + modelSelection.test) |

## UI (web)
| # | Scenario | Expected | | Result |
|---|---|---|---|---|
| 25 | Agent form toggle | Default fixed; switching to auto relabels model/effort as fallback/default; value submitted | W | Pass (AgentFormModelSelectionQa) |
| 26 | Editing existing agent | Toggle reflects stored mode | W | Pass |
| 27 | Assign form | Model/effort selectors only when selected agent is auto; hidden for fixed; reset when switching agent; "agent default" option sends null/omits | W | Pass (AssignTaskFormModelChoiceQa) |
| 28 | Task detail | Shows chosen model/effort when set; nothing (or agent default) for fixed/null | W | Pass (fixed/unknown/unloaded render nothing) |
| 29 | Accessibility | Toggle is a labelled radio group/switch, keyboard operable, selectors have labels, visibility change doesn't lose focus; no color-only info | W/M | Pass automated; manual: arrow-key nav missing (see D3), visual check pending |
| 30 | Old API payloads without `modelSelection`/`modelChoice` | UI does not crash | W | Partial: AgentForm/AssignTaskForm Pass; TaskModelChoice **FAIL** D2 (it.fails) |

## Regression
Full `pnpm -r test`, `pnpm -r typecheck`, lint; existing delegation/import/export tests unchanged.

## Phase 2 results
Automated: `autoModelSelectionQa`, `autoModelMigrationQa`, `autoModelToolsQa` (server); `AgentFormModelSelectionQa`, `AssignTaskFormModelChoiceQa` (web).
Defects:
- **D1 (major)** Invalid `model`/`effort` through delegation gateway creates subtask. Fix pending (Lara).
- **D2 (minor)** `TaskModelChoice` throws if task has no `modelChoice` (`modelChoiceSummary` reads `choice.model`). Test uses `it.fails`.
- **D3 (minor, a11y)** `SegmentedControl` (`components/ui.tsx`) is `role=radiogroup` but every radio is tabbable and arrow keys do nothing (no roving tabindex). Affects all uses.
- **Obs** `delegate_task` tool description does not mention auto; only the param descriptions do.
Manual remaining: screen reader pass, visual contrast of selected radio, end-to-end with real Claude runtime.
