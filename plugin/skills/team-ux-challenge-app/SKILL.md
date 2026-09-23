---
name: team-ux-challenge-app
description: UX Challenge Team for Professional Applications — app audit + websearch for 2026 best practices + per-view adversarial UX↔UI brainstorm + 6 app-specific critics + task-flow analysis + least-friction convergence, producing sprint plans for every view
category: dev-skills
---

# UX Challenge Team — Application Edition

End-to-end adversarial design team for **professional internal software, desktop applications, and SaaS dashboards**. Audits the entire application, researches current best practices via websearch, maps user journeys and task flows, then processes each view through an adversarial UX↔UI pair, six application-specific critics, least-friction convergence, and a sprint plan.

**This is NOT for websites.** For marketing sites, landing pages, or public-facing web pages, use `team-ux-challenge` instead.

## When to Use

- "Design views for [application]" or "redesign the [X] dashboard"
- You want application UX that survives adversarial critique before any code is written
- You need data-dense, workflow-efficient, keyboard-accessible interfaces
- You want converged designs grounded in real 2026 app design research — not fabricated trends
- You want task-flow analysis before wireframes

Do NOT use for:
- Marketing websites, landing pages, or public pages (use `team-ux-challenge` instead)
- Pure research (use `team-design-research` instead)
- Backend-only features
- Quick one-file component tweaks (just use `dev-frontend` directly)
- Implementation (this team hands off to `/team-sprint-planner`)

## What You Need Before Starting

- Target application description (e.g., "sovereign business intelligence platform", "CRM dashboard")
- Existing design system (theme, fonts, colors, component library) — or state "none"
- Any existing design brief, Feature Brief, or IDEA record
- Optional: brand constraints (colors, fonts, voice)

## What This Team Produces

All outputs are written to `docs/ux-challenge-app/new-ux/` in the target repo:

- `new-ux/00-app-audit.md` — full application inventory: every screen, view, panel, drawer, modal, navigation model, design system, reusable components (Stage 0A)
- `new-ux/00-research-brief.md` — REAL websearch research on 2026 app design best practices + competitor UI analysis with sources (Stage 1)
- `new-ux/00-task-flows.md` — user journey maps and task-flow analysis across all views (Stage 1B)
- `new-ux/[NN]-[view-slug]-tight-brief.md` — tight brief per view (Stage 2)
- `new-ux/[NN]-[view-slug]-converged-design.md` — converged design per view: layout spec, interaction spec, component mapping, keyboard shortcuts, accessibility checklist, friction audit, data density assessment (Stages 3–5)
- `new-ux/[NN]-[view-slug]-sprint.md` — sprint plan per view (Stages 6–7)
- `new-ux/XX-gap-analysis.md` — missing views/features + cross-view workflow gaps (Stage 8)

View numbering: `01-business-overview`, `02-pipeline`, etc. — ordered by priority set during audit.

## Agent Sequence

### Phase A: Application Audit + Research (run ONCE)

1. **[Stage 0A]** lead-ux-challenge-app — **Full Application Audit**:
   - Confirm application type, design system, brand constraints, repo target
   - Extract every screen, view, panel, drawer, modal, and navigation state from the codebase
   - Document: navigation model (router vs state machine), layout system, component inventory, design tokens, theming
   - Identify all existing patterns (KPI rows, detail panels, tables, charts, forms, empty states)
   - Output: `new-ux/00-app-audit.md` — a numbered, prioritized view inventory
   - Present to user for confirmation before proceeding
   (1 active)

2. **[Stage 1]** app-research-analyst — **MANDATORY WEBSEARCH** for current application design best practices:
   - Use WebSearch to find **real 2026 articles and resources** on:
     - "best dashboard UI design 2026"
     - "professional software UI trends 2026"
     - "data-dense application design patterns"
     - "kanban board UX best practices"
     - "SaaS dashboard design system"
     - "desktop application UX patterns"
     - "[specific competitor] UI review" (e.g., "Linear app UI design", "Attio CRM design")
   - Use WebFetch to read the top results and extract specific patterns, screenshots, design decisions
   - Research at least 8 real competitor applications (not from memory — from actual web sources)
   - Extract: layout patterns, data density approaches, interaction models, keyboard shortcuts, color systems, chart types
   - Every claim MUST include a source URL
   - Output: `new-ux/00-research-brief.md` with real URLs and evidence
   (1 active)

   **CRITICAL: This stage MUST use the WebSearch and WebFetch tools. A trend brief without real URLs is a failed deliverable. The agent must search the web, not rely on training data.**

3. **[Stage 1B]** lead-ux-challenge-app — **Task-Flow Analysis**:
   - Map the primary user journeys across all views (existing + proposed)
   - Document: "Morning check" flow, "New client" flow, "Campaign analysis" flow, etc.
   - Identify cross-view handoffs and context switches
   - Analyze cognitive load: how many views does a user touch in one workflow?
   - Identify keyboard shortcut opportunities across the full app
   - Output: `new-ux/00-task-flows.md`
   (1 active)

### Phase B: Per-View Design Loop (repeats for EACH view in the audit)

The lead picks the next view from the audit inventory (in priority order) and runs Stages 2–7 for that view. When Stage 7 completes, loop back to Stage 2 for the next view.

4. **[Stage 2]** lead-ux-challenge-app — compresses the research brief + task flows + view-specific context into a tight brief for THIS view (user role, task frequency, data density requirements, workflow position, keyboard expectations)

5. **[Stage 3]** ux-architect + ui-designer — adversarial UX↔UI pair for THIS view. Dynamic brainstorm rounds until the objection log is empty or two consecutive rounds produce identical objections (stall). (2 active)

   **Application-specific brainstorm focus:**
   - Information architecture before layout
   - Data density vs. readability trade-offs
   - Keyboard navigation paths
   - Multi-view workflow continuity
   - Progressive disclosure for power users vs. new users
   - State persistence across view switches

6. **[Stage 4]** 6 application-specific critics in two waves of 3:

   **Wave 1:**
   - **power-user-critic** — Evaluates keyboard efficiency, information density, bulk operations, and workflow speed for daily users. "Can I do this in 3 keystrokes?"
   - **new-user-critic** — Evaluates discoverability, empty states, progressive disclosure, and learning curve. "Can I figure this out without a manual?"
   - **accessibility-critic** — Evaluates screen reader compatibility, keyboard-only navigation, color contrast, ARIA roles, focus management. Goes beyond checklists into real assistive technology workflows.

   **Wave 2:**
   - **performance-critic** — Evaluates render performance, virtualization needs, data volume handling, lazy loading, and perceived speed. "What happens with 10,000 rows?"
   - **data-density-critic** — Evaluates information-per-pixel ratio, chart effectiveness, table readability, metric labeling, and cognitive load. "Is every pixel earning its place?"
   - **workflow-critic** — Evaluates cross-view continuity, context preservation, navigation efficiency, and multi-step task completion. "Does the user lose context when switching views?"

   Each critic produces a severity-ranked concern list for THIS view. (3 active per wave)

7. **[Stage 5]** lead-ux-challenge-app — least-friction convergence for THIS view: resolve objections, tie-break on least-friction rule, escalate genuinely-equal trade-offs to the user

8. **[Stage 6]** lead-ux-challenge-app — lock the design for THIS view, write the implementation plan including:
   - Component hierarchy
   - Zustand store shape (or relevant state management)
   - API contract sketch
   - Keyboard shortcut assignments
   - Theme compatibility notes

9. **[Stage 7]** lead-ux-challenge-app — write sprint plan for THIS view. Sprint output goes to `new-ux/[NN]-[view-slug]-sprint.md`

10. **[LOOP]** If more views remain in the audit inventory → return to Stage 2 for the next view. If all views are done → proceed to Stage 8.

### Phase C: Gap Analysis (run ONCE, after all views processed)

11. **[Stage 8]** lead-ux-challenge-app — **Gap Analysis**:
    - Review the full app audit against completed designs
    - Identify missing views, features, or cross-view workflows
    - Check for: notification system, breadcrumbs, command palette integration, shared components, data export, print views, onboarding flows, settings integration
    - For each gap: describe what it should contain, priority, and sprint impact
    - Output: `new-ux/XX-gap-analysis.md`

## Application Audit Checklist (Stage 0A)

The app audit MUST cover all of these categories:

| Category | What to Extract |
|---|---|
| **Screens/Views** | Every screen, view, or route in the application |
| **Navigation model** | Router-based, state machine, tabs, sidebar — document the pattern |
| **Panels/Drawers** | Slide-in panels, modal dialogs, drawers, overlays |
| **Design system** | Theme tokens, colors, fonts, spacing, component library |
| **Charts/Visualizations** | What chart types exist, what libraries are used |
| **Data tables** | Table patterns, sorting, filtering, pagination, inline editing |
| **Forms** | Form patterns, validation, multi-step flows |
| **Empty states** | How are empty views handled? Consistent or ad-hoc? |
| **Keyboard shortcuts** | What global and view-specific shortcuts exist? |
| **State management** | What stores exist, how is state shared across views? |
| **API layer** | How does the frontend talk to the backend? REST, GraphQL, IPC? |
| **Accessibility** | Current a11y patterns and gaps |
| **Responsive/Platform** | Desktop-only? Responsive? Electron? Tauri? Web? |

## Research Brief Requirements (Stage 1)

The research brief MUST:
- Use WebSearch to find real articles, blog posts, and design showcases
- Include source URLs for every claim
- Cover at least 8 competitor applications
- Focus on 2025-2026 design patterns (not older)
- Address these topics:
  - Dashboard layout patterns (KPI placement, chart types, data density)
  - Data table design (sorting, filtering, inline editing, virtualization)
  - Kanban/pipeline UX (card design, drag-drop, column headers)
  - Chart/visualization best practices (when to use what)
  - Keyboard-first design (shortcut systems, command palettes)
  - Dark theme design (contrast ratios, color coding in dark mode)
  - Desktop application-specific patterns (Electron, Tauri, native feel)
  - Progressive disclosure and information hierarchy

**A research brief without real source URLs is a FAILED deliverable. Do not proceed to Stage 1B until URLs are verified.**

## Key Rules

- Max 3 agents active at once (project rule)
- Stages never overlap (Stage 3 complete before Stage 4 starts)
- Stage 0A app audit MUST complete and receive user confirmation before any design work begins
- **Stage 1 MUST use WebSearch and WebFetch** — no fabricated research
- Stage 1B task-flow analysis MUST complete before any per-view design begins
- Stage 3 brainstorm runs dynamic rounds — never a fixed count; terminate on empty objection log or stall
- Stage 4 critics run in waves of 3, never all 6 at once
- Stage 5 convergence applies least-friction tie-break; genuinely-equal trade-offs escalate to the user, never self-resolved
- The per-view loop (Stages 2–7) continues until ALL views in the audit are processed
- Stage 8 gap analysis is mandatory
- All outputs go to `docs/ux-challenge-app/new-ux/` — one folder for the entire application design
- No commit without user approval of each view's converged design

## Differences from team-ux-challenge (Website Edition)

| Aspect | Website Edition | Application Edition |
|---|---|---|
| **Unit of design** | Page (homepage, pricing, etc.) | View (dashboard, pipeline, etc.) |
| **Research method** | Trend sites (awwwards, land-book) | WebSearch for app design articles + competitor UI |
| **Pre-design analysis** | None | Task-flow analysis (Stage 1B) |
| **Critics** | Buyer personas (Technical, Sceptical, ROI, etc.) | App-specific (Power User, New User, Performance, etc.) |
| **Design focus** | Conversion, emotional arc, CTA placement | Data density, workflow efficiency, keyboard access |
| **Audit scope** | Routes, footer, legal, SEO | Screens, state, API, shortcuts, design tokens |
| **Gap analysis** | Missing pages (about, blog, changelog) | Missing features (notifications, breadcrumbs, export) |
| **Output folder** | `docs/ux-challenge/new-ux/` | `docs/ux-challenge-app/new-ux/` |

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using fabricated competitor analysis | Stage 1 MUST use WebSearch. No URLs = failed deliverable |
| Jumping to wireframes before task-flow analysis | Stage 1B maps user journeys FIRST. Wireframes come in Stage 3 |
| Using website-oriented critics (buyer personas) | Use the 6 app-specific critics defined above |
| Designing views in isolation | Task-flow analysis (Stage 1B) ensures cross-view coherence |
| Ignoring keyboard workflows | Every view must specify keyboard shortcuts in the converged design |
| Skipping performance considerations | performance-critic evaluates what happens at scale (1000+ items) |
| Treating the app like a website | No SEO, no footer links, no CTA-for-visitors, no marketing conversion |
| Only designing new views | The audit includes existing views — redesign recommendations are valid |
| Skipping gap analysis (Stage 8) | Always check for missing cross-view features (notifications, breadcrumbs, export) |
| Not specifying state management in designs | Stage 6 must include store shape and API contract sketch |
