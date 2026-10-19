---
name: Obsidian Fleet Engine
colors:
  surface: '#12131a'
  surface-dim: '#12131a'
  surface-bright: '#383941'
  surface-container-lowest: '#0d0e15'
  surface-container-low: '#1a1b22'
  surface-container: '#1e1f26'
  surface-container-high: '#292931'
  surface-container-highest: '#33343c'
  on-surface: '#e3e1ec'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e3e1ec'
  inverse-on-surface: '#2f3038'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#12131a'
  on-background: '#e3e1ec'
  surface-variant: '#33343c'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
  headline-md:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
  headline-sm:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: Geist
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.25rem
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
  label-mono-xs:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 0.875rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system is crafted for high-velocity AI engineers, distributed autonomous agent operators, and technical founders orchestrating complex parallel execution trees. The brand personality embodies precision, absolute operational control, surgical clarity, and deep terminal-grade focus. It eliminates unnecessary decorative flourishes in favor of high-density ergonomics, micro-status signifiers, and instant telemetry comprehension.

The design movement blends **Technical Minimalism** with **Refined Developer Terminal Ergonomics**. It leverages a deep obsidian canvas (`#090A0F`), crisp microscopic borders (`1px` hairline rules with deliberate low-opacity alphas), monospaced telemetry clusters, and localized luminescence for state changes. Visual noise is aggressively suppressed so real-time tool calls, subtask cascades, streaming agent outputs, and token metrics emerge with surgical clarity.

## Colors

The color palette centers on an ultra-deep charcoal slate/zinc base, avoiding pure `#000000` to maintain perceptual depth and avoid harsh optical clipping.

- **Canvas & Surfaces:**
  - Base canvas: `#090A0F`
  - Subsurface / Card Container: `#11131A`
  - Elevated Popover / Dropdown: `#161922`
  - Active / Row Hover State: `#1D212C`
  - Subtle Borders & Separators: `rgba(255, 255, 255, 0.08)`
  - Active / Focus Borders: `rgba(99, 102, 241, 0.45)`

- **Action & Accent Roles:**
  - **Primary Indigo (`#6366F1`):** Applied exclusively to principal calls-to-action (e.g., "Nueva tarea", primary dispatch), active navigation states, and current node focus.
  - **Success Emerald (`#10B981`):** Denotes healthy execution, successful subtask resolution, and green exit codes. Background tint: `rgba(16, 185, 129, 0.12)`.
  - **Warning Amber (`#F59E0B`):** Reserved for paused tasks, human-in-the-loop approvals ("Esperando subtareas"), and non-blocking warnings. Background tint: `rgba(245, 158, 11, 0.12)`.
  - **Destructive Crimson (`#EF4444`):** Flags failed runs, exit code failures, and syntax interrupts. Background tint: `rgba(239, 68, 68, 0.12)`.
  - **Process Cyan / Sky (`#38BDF8`):** Indicates active streaming runs, open execution loops, and real-time network pings.

## Typography

Typography prioritizes rapid code parsing, high legibility during dense tabular scanning, and unambiguous character delineation. 

- **Display & Interface Text (`Geist`):** Delivers clean geometry with a neutral tone, keeping task descriptions, headers, and UI controls legible at high scale without distraction.
- **Code & Telemetry Data (`JetBrains Mono`):** Applied to tool invocations (`create_task`, `delegate_task`), git branches, diff previews, token metrics, execution durations, and terminal logs.
- **Micro-Labels & Status:** All tabular meta keys, prompt metadata, and timestamps leverage `label-mono-sm` or `label-mono-xs` with uppercase tracking (`letterSpacing: 0.04em`) to establish visual separation from prose responses.

## Layout & Spacing

The layout is built for high information density across multi-column IDE-style environments. It utilizes a 12-column dynamic grid alongside persistent split-pane ergonomics.

- **Desktop Layout:** Standard configuration uses a full-bleed horizontal masthead (height: `52px`) over a persistent dual-pane workspace: a fluid primary stream (collapsible execution log and conversation canvas) spanning 8 columns, paired with an ergonomic 4-column contextual inspection rail (subtask delegations, agent tree hierarchy, and resource consumption).
- **Responsive Adaptations:**
  - **Desktop (`>= 1280px`):** Full parallel workflow: side-by-side execution trace + delegation inspector.
  - **Tablet / Small Laptop (`768px - 1279px`):** Context rail collapses into an off-canvas slide-over drawer triggered by header telemetry chips.
  - **Mobile (`< 768px`):** Single-column layout. Tabular task lists convert into stacked cards; mono telemetry shifts to wrapping chips.
- **Grid & Gaps:** Component spacing adheres to a strict 4px sub-grid (`0.25rem` increments). Internal log blocks maintain tight padding (`0.5rem` to `0.75rem`) to maximize visible vertical history without excessive scrolling.

## Elevation & Depth

Visual depth is achieved through **Tonal Tiering and Low-Contrast Hairline Outlines**, rejecting heavy drop shadows that muddy dark themes.

- **Tier 0 (Canvas Base):** `#090A0F` — The root viewport and background for terminal stream buffers.
- **Tier 1 (Surface Cards & Accordion Shells):** `#11131A` with a 1px solid border (`rgba(255, 255, 255, 0.08)`).
- **Tier 2 (Collapsible Steps & Nested Tool Calls):** `#161922` nested inside Tier 1, creating structural indentation without requiring heavy margin indents.
- **Tier 3 (Floating Menus & Dropdowns):** `#1A1D27` combined with an ambient diffused shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.65)` and `0 0 0 1px rgba(255, 255, 255, 0.12)`.
- **Active Node Halo:** When an agent or task node is active, depth is communicated through a subtle internal glow (`box-shadow: inset 0 0 0 1px #6366F1, 0 0 16px -4px rgba(99, 102, 241, 0.25)`).

## Shapes

The design uses **Soft (Level 1)** geometric curvature. This preserves an engineered, terminal-adjacent feel without harsh 90-degree corners.

- **Base Controls & Badges:** `0.25rem` (4px) corner radius for chips, action buttons, command pills, and code tokens.
- **Card Panels & Split Panes:** `0.5rem` (8px) corner radius for macro-containers, accordions, and stream log windows.
- **Dialogs & Overlay Trays:** `0.75rem` (12px) maximum radius.
- **Interactive State Indication:** Buttons and collapsible logs transition their corner profiles consistently to ensure nested tools do not produce visual dissonance when grouped.

## Components

### Buttons & Quick Actions
- **Primary Action:** Solid `#6366F1` background, `#FFFFFF` text, `4px` border radius, subtle hover lift with `background: #4F46E5`. Compact vertical padding (`6px 14px`).
- **Secondary / Ghost Action:** Transparent background, `1px solid rgba(255, 255, 255, 0.12)`, text `#E4E4E7`. On hover: `background: rgba(255, 255, 255, 0.05)`, border color `#A1A1AA`.
- **Micro Terminal Actions (Copy, Collapse, Re-run):** Dimension `24x24px`, borderless ghost icon buttons with `color: #71717A` transitioning to `#FAFAFA`.

### Status Chips & Badges
- Compact height (`20px`), font `JetBrains Mono` (`11px`, weight `500`), horizontal padding `6px`.
- **Completada (Success):** Background `rgba(16, 185, 129, 0.12)`, text `#34D399`, border `1px solid rgba(16, 185, 129, 0.25)`.
- **Trabajando / En Curso (Active):** Background `rgba(56, 189, 248, 0.12)`, text `#38BDF8`, border `1px solid rgba(56, 189, 248, 0.25)`, accompanied by a pulsating `4px` indicator dot.
- **Esperando Subtareas (Warning):** Background `rgba(245, 158, 11, 0.12)`, text `#FBBF24`, border `1px solid rgba(245, 158, 11, 0.25)`.

### Accordion & Collapsible Tool Execution Traces
- **Collapsed Header:** Background `#11131A`, subtle left status indicator bar (`2px width`), chevron toggle rotated `90deg` on expansion, monospaced tool name (`Bash`, `Grep`, `delegate_task`) highlighted in bold mono.
- **Expanded Body:** Darker sub-canvas `#0B0C10`, monospace code output block with custom minimal scrollbars, syntax color rendering, and top-right pinned clipboard controls.

### Form Inputs & Chat Console
- **Chat & Prompt Input Bar:** Grounded multi-line text container with `#11131A` background, border `1px solid rgba(255, 255, 255, 0.12)`, and active focus ring `0 0 0 1px #6366F1`. Bottom action strip cleanly groups model picker chips, context token countdown (`JetBrains Mono`), and the dispatch icon button.
- **Filter Selectors & Dropdowns:** Flat dark triggers with embedded micro-labels ("AGRUPAR POR", "ORDENAR POR"), subtle chevron, and compact menu flyouts.

### Agent Fleet Architecture Graph / Hierarchy Tree
- Canvas node cards for agents (`Conde`, `Acosa`, `Lara`, `Vega`) using crisp hairline borders, role badges, model tags (`opus`, `sonnet`), and active delegation lines rendered in muted slate (`rgba(255, 255, 255, 0.2)`) with animated directional dashes for live task passing.