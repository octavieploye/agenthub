---
name: frontend-code-review
description: Senior frontend code review for any coding project — React/Vue/Angular/Svelte/vanilla JS, TypeScript strict, UI wiring, dead code, state management, test coverage gaps. Adapts to the project's detected stack. Use when the user says "review frontend", "frontend-code-review", or "/frontend-code-review"
category: frontend
---

# Frontend Code Review — 5-Phase Workflow

You are orchestrating a deep, senior-level frontend audit. This skill adapts to any project type: web app, SaaS, desktop, e-commerce, industrial HMI, mobile-first PWA.

**Rules:**
- First detect the stack (framework, language, test runner, type system) — never assume
- All issues ranked: CRITICAL → HIGH → MEDIUM → LOW
- Fix code, never tests
- Output report to `_output/frontend-review-{date}.md` (or `docs/` if that convention exists in the project)

---

## Phase 0 — STACK DETECTION

Before dispatching any agents, the lead reads:
- `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` — identify language and framework
- Root config files: `tsconfig.json`, `vite.config.*`, `webpack.config.*`, `next.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*`
- Test runner: Jest, Vitest, Playwright, Cypress, pytest, etc.
- State management: Redux, Zustand, Pinia, MobX, Signals, Vuex, context-only, etc.
- Build tool: Vite, Webpack, Turbopack, esbuild, Rollup, etc.

Announce the detected stack to the user before proceeding:
```
Stack detected:
  Framework: {React 18 / Vue 3 / Angular 17 / Svelte 5 / Vanilla JS / ...}
  Language: {TypeScript / JavaScript / Python (Pyodide) / ...}
  Test runner: {Vitest / Jest / Playwright / Cypress / pytest / ...}
  State: {Zustand / Pinia / Redux Toolkit / signals / context / none}
  Build: {Vite / Webpack / Next.js / Nuxt / ...}
  Frontend source: {auto-detected root, e.g. src/, app/, frontend/, client/}
Proceed? (yes / correct me)
```

Wait for user confirmation before Phase 1.

**TypeScript gate (if TypeScript detected):**
```bash
npx tsc --noEmit    # or: yarn tsc / pnpm tsc
```
If 6+ TS errors: HARD STOP — fix before audit begins.
If 1–5: surface and ask user.
If 0 or no TypeScript: proceed.

---

## Phase 1 — PARALLEL AUDIT

Dispatch three sub-agents simultaneously, each scoped to the detected frontend source directory:

### audit-patterns (Framework Patterns Specialist)

Adapt checks to the detected framework:

**React / Preact:**
- `key={index}` in any list render
- Missing `useEffect` cleanup (event listeners, timers, subscriptions)
- Stale closures in callbacks without correct dependency arrays
- State updates after unmount (missing abort controllers)
- Conditional hook calls
- Direct DOM mutations without refs
- Missing error boundaries

**Vue 3:**
- Missing `onUnmounted` cleanup for watchers and listeners
- Reactive objects mutated directly outside `reactive()`/`ref()`
- `v-for` without `:key` or `:key="index"`
- Async setup without proper error handling
- `defineProps` without type/validation

**Angular:**
- Subscriptions not unsubscribed (`takeUntilDestroyed` or manual unsubscribe)
- `OnPush` components with mutable inputs
- `ChangeDetectorRef.detectChanges()` called in tight loops
- Missing `trackBy` in `*ngFor`

**Svelte:**
- Stores subscribed without `$` prefix outside `.svelte` files
- `onDestroy` missing for timers/intervals
- Reactive statements (`$:`) with side effects

**Vanilla JS / framework-agnostic:**
- Event listeners added without corresponding `removeEventListener`
- `setInterval` / `setTimeout` without cleanup references
- Global state mutation patterns
- Missing null checks on DOM queries

### audit-types (Type Safety Specialist)

**TypeScript projects:**
- `any` casts (`as any`, `: any`) — every instance is a finding
- `// @ts-ignore` or `// @ts-expect-error` without justification
- Non-null assertions (`!`) on values that could genuinely be null
- Missing return types on exported functions
- Unsafe type widening without guards
- API response types: untyped or `any`-typed fetch/axios/query calls

**JavaScript projects:**
- JSDoc types missing on public functions
- `==` instead of `===` comparisons
- Implicit global variable leaks (missing `const`/`let`/`var`)
- `typeof` checks omitted before property access on unknown values

### audit-wiring (UI Wiring & Dead Code Specialist)

Framework-agnostic checks:
- Components/modules defined but never imported or rendered anywhere
- Routes declared but no component assigned
- Feature flags or dev-only code committed to main branch
- Hardcoded localhost URLs, API keys, or test credentials committed
- Broken asset imports (images, fonts, icons that don't resolve)
- API/data calls that fire at module scope (before framework mounts)
- Missing loading and error states for async data fetching
- Layout bugs: scroll containers missing `overflow` constraints, height chains
- Dead CSS classes (if Tailwind: unused custom classes; if CSS modules: unused selectors)
- State management: stores imported but never subscribed to by any component

**Per communication layer:**
- REST: fetch/axios calls with no error handling
- GraphQL: queries with no error/loading state
- WebSocket: connections opened but never closed on component destroy
- SSE/EventSource: not closed on unmount
- Electron IPC / Tauri commands: invoked without `.catch()` or error branch
- gRPC-web: streams not cancelled on unmount

Collect all three outputs. Merge into a single deduplicated master issue list with severity, file:line, and framework context.

---

## Phase 2 — PLAN

Group issues by workstream:
- **WS-A** — Framework correctness (lifecycle, reactivity, event cleanup)
- **WS-B** — Type safety (types, casts, guards)
- **WS-C** — UI wiring, dead code, layout, assets, API error handling

Any issue spanning multiple workstreams → mark as **sequential**.

Write plan to the review report file.

---

## Phase 3 — FIX

Dispatch fix agents per workstream simultaneously:
- **fix-framework** → WS-A files only
- **fix-types** → WS-B files only
- **fix-wiring** → WS-C files only

Each agent: minimal targeted fixes. Do not touch other workstreams' files.

After fixes: re-run type check (if TypeScript). Must be 0 errors before proceeding.
Run test suite: `{detected test command}` — no regressions.

---

## Phase 4 — VERIFY

Single verify agent checks:
- Every CRITICAL and HIGH issue from Phase 1: RESOLVED / PARTIAL / STILL PRESENT
- Type check: 0 errors (if TypeScript project)
- No regressions in test suite

Compile remaining issues list.

---

## Phase 5 — LOG

Write final report to `_output/frontend-review-{date}.md`:

| | Count |
|---|---|
| Stack detected | {framework + language} |
| Issues found | — |
| Issues fixed | — |
| Deferred | — |
| TS errors before / after | — / 0 (or N/A) |
| Tests passing (final) | — |

Present summary table to user.
