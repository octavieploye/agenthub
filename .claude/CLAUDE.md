# [OPTIMAEUS-UNIVERSAL-IMPORT]
# Optimaeus Universal Standards — imported automatically by Claude Code.
# Source: /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/shared/UNIVERSAL-STANDARDS.md
# Do not edit this block manually — re-run bootstrap-universal.sh to update.
@/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/shared/UNIVERSAL-STANDARDS.md
# Entity definition for hephaestus:
@/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/.claude/entities/hephaestus.md
# [/OPTIMAEUS-UNIVERSAL-IMPORT]
@.claude/how-to-index.md

---

# Project Context

This management tool is designed to orchestrate multiple AI agents (specifically Claude CLI sessions) simultaneously across different repositories and business contexts, addressing the limitations of the standard Claude desktop app and terminal.

## Core Principles

- **UPDATE HOW-TO DOCS** — When adding a new feature or refactoring an existing one,
  update (or create) the corresponding `docs/how-to/<NN-slug>.md` file. This file feeds
  both the in-app guide panel and LLM context via `.claude/how-to-index.md`. If no file
  exists for the feature yet, create one with the next available `NN` prefix. Write in
  plain user-facing language — step-by-step instructions, no implementation details.
  Update `.claude/how-to-index.md` if you create a new file.

- **ROLE OF THIS FILE** - describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you,please alert the developer working with you and indicate that this is the case in the AgentMD(code-dev1.md,code-dev2.md,code-tester.md,code-reviewer.md,code-expert.md,code-uiux.md..etc) file to help prevent future agents from having the same issue
- **DO NOT TAKE ANY ACTION** - report any confusion and discrepencies before taking any further action when coding from sprints or from previous code. If more than 2 you list them and show them to the user for review

- **USER IS THE SOURCE OF TRUTH. USER IS ABOVE ALL THE .MD FILES AND AI KNOWLEDGE**
- **NEVER ASSUME** — always countercheck answers with facts.
- **NEVER CHANGE TESTS TO PASS** — tests define expected behavior; fix the code, not the test.
- **ERRORS ARE SYMPTOMS** — always look for the root cause, not the surface fix. do not code unless you can 100% countercheck that your fix will work
- **NEVER EDIT `.gitignore`** — Do not modify, overwrite, or remove entries from `.gitignore` under any circumstances. You may suggest additions to the user, but never make changes yourself. Only the user can approve and apply `.gitignore` changes.
- **YOU SHOULD TYPE-CHECKING ALL OF YOUR CHANGES**

## Crash Debugging

When investigating app crashes or unexpected restarts:

- **Log file:** `~/Library/Logs/agenthub/main.log` — always check this first
- **Heartbeat entries** appear every 30s with memory usage (rss/heapUsed/heapTotal in MB) — look at the trend before the last entry
- **Renderer errors** (`window.onerror`, unhandled rejections) are forwarded from the renderer via `log:renderer-error` IPC — look for `Renderer error` entries
- **WebGL context loss** is logged with the `agentId` — look for `WebGL context lost in renderer`
- **IPC flood** is logged if `agentOutput` exceeds 100 msg/s for 3 consecutive seconds — look for `Renderer IPC flood detected`
- **Renderer process gone** / **Renderer became unresponsive** are Electron-level events logged in main

Key files to read when debugging crashes:
- `src/renderer/src/crash-logger.ts` — all renderer-side observers
- `src/main/ipc/log.ipc.ts` — how renderer errors reach electron-log
- `src/main/index.ts` — main process error hooks and heartbeat
- `src/main/services/recovery-manager.ts` — crash recovery logic

## Dependency & Version Management

- **NEVER downgrade or change a dependency version without user approval.** If a dependency version specified in a blueprint or POM conflicts with the code API, STOP and report the discrepancy to the user. Present both options (upgrade code vs. downgrade version) and let the user decide.
- **NEVER silently change library versions, Spring Boot versions, or plugin versions.** These are architectural decisions that belong to the user.
- **When a blueprint has an internal inconsistency** (e.g., POM says version X but code uses version Y API), treat it as a blocker. Do not resolve it yourself — flag it, explain both sides, and ask for guidance.
- **This applies to all agents.** No agent has authority to change dependency versions autonomously.

## Code Best Practices

- **Do not be conservative** — write complete MVP code. Minimum code leads to functions and functionalities not being wired properly.
- **Once functionality is coded, verify it is wired properly and migrations pass.**
- **Do not nest beyond level 1.**
- **Name folders and files according to functionality or task.**
- **1 function = 1 functionality** — each function does one thing.

### Code Organization (enforce from first line of code)

When code in a section exceeds 1000 lines, create these folders:

- `helpers/` — reusable utility functions
- `middleware/` — request/response processing
- `adapters/` — external system integrations
- `handlers/` — business logic entry points

### When to Extract to helpers/middleware/adapters/handlers

- Function is used multiple times across multiple files.
- Function nesting exceeds level 2.
- Function can be reused in different code/files/functions.
- To prevent any single code file from exceeding 1000 lines.

## Testing Philosophy — Real Tests, No Mocks

- **NEVER mock modules with `vi.mock()` or `jest.mock()` to fake out real behavior.** Tests must exercise real code paths with real side effects. If a test needs a filesystem, a socket, a server, or a database — use the real thing. Fake implementations hide bugs and give false confidence.
- **Mock boundaries only** — the only acceptable mocks are for things you do NOT own and cannot run locally: external HTTP APIs, third-party SaaS services, Electron's `BrowserWindow` (which requires a running Electron process). Everything else runs for real.
- **Use `vi.fn()` for callbacks and spies** — spy on whether a callback was called, what arguments it received, etc. That is observation, not faking.
- **If a test is hard to write without mocks, the code has a design problem.** Fix the design (dependency injection, interfaces, smaller functions) instead of papering over it with mocks.
- **Integration tests over unit tests.** Prefer tests that prove the system works end-to-end. A test that starts a real Unix socket server and connects a real client is worth ten tests with mocked `net.createServer`.
- **Test files should clean up after themselves.** Create temp dirs, sockets, or files in `beforeEach` and remove them in `afterEach`. Never leave artifacts on disk.

## Coding Workflow

1. **Write a failing test first.**
2. **Build the implementation.**
3. **Run the test.**
4. **After 3 failed attempts** — STOP. Report findings to the user. Ask if you should implement a new test strategy or call in help from another agent to look for a new angle. Do not keep retrying the same approach or writing catch code that has never been tested.

## Naming Restrictions

- **NEVER use "URSSAF"** in any code, documentation, commit message, comment, or file. This is a portfolio project — no employer names in the codebase.


- **YOU SHOULD TYPE-CHECKING ALL OF YOUR CHANGES**



## Dependency & Version Management

- **NEVER downgrade or change a dependency version without user approval.** 

- **This applies to all agents.** No agent has authority to change dependency versions autonomously.
  
****AGENT TEAM**

# CLAUDE.md

## Default Agent Team

- Default team name for this repo: `dev-stack`
- Max active teammates at once: 3
- Only `git-ops` is allowed to make git commits, following `.claude/commands/git-commit.md`.

When working in this repository, always prefer the `dev-stack` agent team and respect these constraints.

---

## High-Level Flow

1. Lead plans work and spawns scouts (max 3 agents total).
2. Scouts map backend, frontend, and integration wiring.
3. Architect reviews scout insights and proposes architecture/plan.
4. Devs implement changes; testers validate.
5. Troubleshooter analyzes reported issues and conflicts.
6. Git-ops commits changes according to `.claude/commands/git-commit.md`.

The lead is responsible for enforcing the 3-agent concurrency rule and delegating tasks.

---

## Roles

### Lead

- Orchestrates the entire team and owns the shared task list.
- Decides which agents to spawn or pause (never more than 3 active).
- Acts as **devil’s advocate** when reviewing troubleshooting analyses and risky changes.
- Coordinates handoffs between scouts, devs, testers, troubleshooter, and git-ops.

---

### Scouts

#### `scout-backend`

- Reads/searches backend code, APIs, data models, and infrastructure.
- Produces:
  - Backend architecture map (modules, services, data flow).
  - List of risks, code smells, missing tests, and API contract ambiguities.

#### `scout-frontend`

- Reads/searches frontend code: components, routing, state management, UI library usage.
- Produces:
  - UI architecture map (routes, major components, state flows).
  - List of UX issues, technical risks, and missing test coverage.

#### `scout-integration`

- Verifies backend, frontend, and UX flows are correctly wired end-to-end.
- Produces:
  - Map of cross-layer contracts (types, payloads, endpoints, error handling).
  - List of mismatches, broken flows, and integration risks.

---

### Devs / Builders

#### `dev-backend`

- Implements and refactors backend features, APIs, business logic, and backend tests.
- Uses scout and architect outputs to guide changes.
- Collaborates closely with `tester-backend` and `dev-integration`.

#### `dev-frontend`

- Implements and refactors UI, state, routing, and interaction logic.
- Uses scout and architect outputs to stay aligned with UX and integration requirements.
- Collaborates closely with `tester-frontend` and `dev-integration`.

#### `dev-integration`

- Ensures backend, frontend, and UI/UX are correctly wired together.
- Fixes contract mismatches, wiring bugs, and cross-layer issues.
- Coordinates with both backend and frontend devs and the architect.

---

### Architect

- Synthesizes insights from all scouts into:
  - Architecture diagrams/notes.
  - High-level implementation plans and refactor strategies.
- Reviews risky or structural changes before they are finalized.
- Provides guidelines that devs and testers should follow.

---

### Troubleshooter

- Aggregates all reported symptoms, bugs, failing tests, logs, and relevant files from scouts, devs, and testers.
- Produces:
  - Structured troubleshooting analyses (hypotheses, likely root causes).
  - Prioritized list of issues and suggested experiments/fixes.
- Works under lead supervision; lead challenges assumptions as devil’s advocate.

---

### Testers

#### `tester-backend`

- Designs and runs backend-focused tests (unit, integration, API tests).
- Reports:
  - Failing tests and error messages.
  - Gaps in backend test coverage and edge cases.
- Works closely with `dev-backend` and `troubleshooter`.

#### `tester-frontend`

- Designs and runs frontend/UI tests (unit, component, E2E).
- Reports:
  - Visual/UX regressions and broken flows.
  - Gaps in frontend test coverage and edge cases.
- Works closely with `dev-frontend` and `troubleshooter`.

---

### Security & DevOps

#### `sec-devops`

- Multi-mode security and DevOps auditor. Floats across all phases — not phase-locked.
- Invoked by: **Lead** (counts as 1 of 3 active agents) or **Human** (exempt from the 3-agent cap).
- Covers 6 domains: code security (OWASP Top 10), data leakage, dependency risks, DevOps/infrastructure, architecture conflicts, future-proofing.
- Produces on each scan:
  - Per-scan report: `docs/superpowers/security/YYYY-MM-DD-HH-MM-<scope>-security-report.md`
  - Updated aggregate audit trail: `docs/superpowers/security/security-log.md`
  - Updated agent memory: `.claire/sec-devops.md`
- CRITICAL findings are shown inline immediately and must be resolved (fix, accepted-risk with human sign-off, or deferred) before `git-ops` may commit.
- Does NOT fix code. Does NOT modify `.gitignore`. Does NOT change dependency versions.
- Full protocol: `.claude/commands/sec-devops.md`

---

### Git Ops

#### `git-ops`

- Sole agent allowed to run `git commit` in this repo.
- Must follow `.claude/commands/git-commit.md` exactly for commit messages and grouping.
- Should only commit after:
  - Relevant tests pass.
  - Lead approves the change set.
  - `docs/superpowers/security/security-log.md` contains no open CRITICAL findings. If open CRITICALs exist, escalate to Lead and human before proceeding.
- Never force-push or rewrite history unless explicitly instructed by the human.

---

## Concurrency Rules

- At any moment, at most **3** teammates (including scouts, devs, testers, troubleshooter, architect, git-ops) should be active.
- The lead must:
  - Prefer short, focused tasks.
  - Pause or complete existing tasks before spawning new agents.
- `sec-devops` counts as 1 of the 3-agent cap when spawned by Lead. Human-direct invocations are exempt from the cap.
- Suggested patterns:
  - Mapping phase: `scout-backend`, `scout-frontend`, `scout-integration`.
  - Architecture audit: `sec-devops spec <path>` (Lead-spawned, counts as 1 of 3).
  - Implementation phase: `dev-backend`, `dev-frontend`, `dev-integration`.
  - Validation phase: `tester-backend`, `tester-frontend`, `troubleshooter` (one or two at a time, never exceeding 3 active agents).
  - Pre-commit gate: `sec-devops` (Lead-spawned, counts as 1 of 3) before calling `git-ops`.
