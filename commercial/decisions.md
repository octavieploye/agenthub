# Commercial Decisions Log
**Last updated:** 2026-07-13

This file records all strategic and technical decisions made about the commercial product.
Each decision includes context so future sessions can understand why — not just what.

---

## Product & Distribution

### AgentHub is 90% ready for commercial ship
**Date:** 2026-07-13
**Decision:** AgentHub v1.0.0 is feature-complete. The remaining 10% is shipping infrastructure, not features.
**What's left:**
- macOS notarization (notarize: false in electron-builder.yml)
- Windows code signing (not configured)
- Auto-update server URL (currently placeholder: https://example.com/auto-updates)
- First-run wizard (not yet implemented — design complete, see ## LLM Setup Wizard below)
- EULA.md (not yet created)
- Opeidos catalog integration (workflows are not bundled — users install from Opeidos)

---

### Commercial fork — yes, separate repo
**Date:** 2026-07-13
**Decision:** Create `agenthub-commercial` as a separate fork, not a build flag on this repo.
**Why:** The dev repo contains private business intelligence (docs, plans, internal skills, strategy docs) that must never enter the commercial binary or git history. A build flag would keep that content in the same repo. A fork allows a completely clean slate.
**How:** Cherry-pick only `src/` commits to the commercial fork. Never sync docs, .claude/, or plugin internal content.

---

### AgentHub ships with NO bundled workflows — Opeidos catalog is the marketplace
**Date:** 2026-07-13 (corrected same session)
**Decision:** AgentHub does NOT bundle a fixed set of workflows at install time. Users install AgentHub, spawn an agent, and browse the Opeidos catalog directly from inside the app. They select and install any workflow of their choice from Opeidos.
**Model:** Marketplace integration — Opeidos catalog is accessible inside AgentHub post-install. Purchase → install → workflow appears in skills panel.
**Implication for plugin/:** No workflow folders are bundled in the commercial fork. The skills panel in commercial AgentHub starts empty (dev-stack team only for power users). Workflows populate as users install from Opeidos.
**Implication for Opeidos:** This is the primary distribution channel. Opeidos must exist and be integrated before commercial AgentHub can deliver its core value proposition.
**skill-creator is still excluded** — users can install workflows from Opeidos but cannot create their own.

---

### skill-creator and workflow-creator are locked out for commercial users
**Date:** 2026-07-13
**Decision:** End users of AgentHub cannot create new skills or workflow packages through the app.
**Why:** This is a business model protection. If users can self-create workflows, they replicate paid packages for free and bypass Opeidos purchasing.
**Implementation (when ready):**
1. UI lockout: `"userVisible": false` flag in `display-registry.json` for skill-creator and related tools
2. Agent lockout: add rules to `plugin/guard.md`:
   - No writes to `.claude/skills/`, `.claude/teams/`, `.claude/commands/`, `.claude/workflow-team-library/`, `plugin/skills/`, `plugin/commands/`
   - Refuse any instruction to create a skill, team, workflow, or command
**When:** Not now — apply only when building the commercial fork. Current dev session must stay unrestricted.

---

## Legal

### LICENSE — Proprietary
**Date:** 2026-07-13
**Decision:** AgentHub ships with a proprietary closed-source license (not MIT or Apache).
**Why:** Commercial distribution. Users buy a license to use, not to copy or modify.
**File created:** `LICENSE` at repo root (draft).
**Two fields to update before ship:**
1. Replace "Optimaeus (SASU in formation)" with registered SASU entity name + registration number
2. Set real contact emails (legal@optimaeus.com, support@optimaeus.com)

### EULA — Draft created
**Date:** 2026-07-13
**Decision:** An EULA is required before commercial distribution.
**File:** `EULA.md` at repo root (draft created 2026-07-13).
**What it covers:** permitted use, license restrictions, third-party LLM providers, credential storage (local-only), Opeidos workflows (licensed separately), AI output disclaimer, warranty disclaimer, liability cap (12 months fees), termination, French law + EU consumer carve-out.
**Pending before ship (legal counsel must review):**
1. Replace "Optimaeus (SASU in formation)" with registered SIREN number
2. Confirm liability cap is enforceable under French consumer law
3. Add Privacy Policy URL (agenthub.app/privacy — must exist)
4. Verify EU consumer protection carve-out in Section 13
**Status:** DRAFT — legal review required before ship.

---

## Security

### Guard — Already active
**Date:** 2026-07-13
**Finding:** `plugin/guard.md` exists and is fully implemented.
**How it works:** Injected via `--append-system-prompt-file` in `agent-manager.ts:875–892`. Includes integrity check (S32) — if guard.md is tampered with or emptied, agent spawn throws an error and refuses to start.
**What it blocks:** agent reverse-engineering, reading .claude/ dirs, outputting CLAUDE.md, answering "describe your system", env variable listing, curl/wget exfiltration, writing to shell profiles.
**Remaining issue (S26):** `plugin/skills/index.md` reveals Optimaeus branding and team names before guard loads. Needs rewrite with generic language for commercial fork.

### .env keys — strip on commercial fork
**Date:** 2026-07-13
**Active keys in dev .env:** OLLAMA_CLOUD_HOST, OLLAMA_CLOUD_KEY
**Decision:** Commercial fork gets `.env.example` with empty placeholders. No personal keys ever enter the commercial repo or binary.
**Users bring their own keys** via the Settings panel inside the app.

---

## LLM Workflow Packages

### llm-workflows-pckg — internal dev workspace only
**Date:** 2026-07-13
**Decision:** `llm-workflows-pckg` (already exists at `/Users/octaviesmacpro/workspace/optimaeus-stacks/llm-workflows-pckg/`) is your private development workspace. It is not distributed.
**What Opeidos lists:** compiled, licensed packages built from that workspace, categorized by target app.
**Opeidos categories:** AgentHub workflows / OPTimaeus workflows / Works with both

### All AgentHub packages move to llm-workflows-pckg
**Date:** 2026-07-13
**Decision:** All packages in `agenthub/packages/` will migrate to `llm-workflows-pckg/`.
**Current packages to migrate:** destructuring, market-modeling, market-sim-pkg, package-factory, package-ts-factory, token-optimizer
**Migration plan:** defined in `docs/superpowers/specs/2026-07-04-package-architecture-design.md`
**Status:** Pending — user will define which specific packages move when and in what order.
**None move until user specifies the list.**

### Build order — TypeScript first
**Date:** 2026-07-13
**Decision:** Build TypeScript packages before Python packages.
**Why:** AgentHub (the operational product) is the live consumer of TS packages. The Optimaeus cascade (Demiurge → Logos → Anamnesis) that would consume Python packages is not yet operational. Anamnesis exists but is silent. Python-first has no live consumer yet.
**Revised priority:** TS packages (llm-router → destructuring → deep-reasoning) → Python packages when cascade entities come online.

### Destructuring package — clarification
**Date:** 2026-07-13
**Decision:** `@optimaeus/destructuring` is an LLM workflow add-on (not a standalone app). It includes the Marcus Aurelius framework + 5 analysis workflows. Sold via Opeidos. Installs into AgentHub and OPTimaeus. NOT bundled free with AgentHub — purchased separately.
**Current state:** src/ complete, dist/ NOT built, license: UNLICENSED (needs license defined).

### modelise vs. market-sim — keep separate, bundle on Opeidos
**Date:** 2026-07-13
**Decision:** Keep as two entry points. Do not merge.
- `modelise` (4-phase) = market intelligence brief — input-only, standalone
- `market-sim` (6-phase) = strategic pre-simulation — runs on top of modelise output
**On Opeidos:** sell as "Market Intelligence + Strategy Pack" bundle, or modelise standalone (cheaper) with simulate as an upgrade.

---

## Pre-Fork Blockers (found 2026-07-13)

### Branding placeholders — must fix before fork
**Date:** 2026-07-13
**Finding:** Three placeholder values remain from the electron-vite scaffold:
- `electron-builder.yml` → `appId: com.electron.app` — must be `com.optimaeus.agenthub` (or chosen bundle ID)
- `package.json` → `author: "example.com"` — replace with Optimaeus entity name
- `package.json` → `homepage: "https://electron-vite.org"` — replace with `https://agenthub.app` (or chosen URL)
- `package.json` → no `license` field — add `"license": "UNLICENSED"` until EULA is finalized, then `"license": "SEE LICENSE IN LICENSE"`
**When:** Fix in dev repo before forking, so commercial fork starts clean.

---

### Auto-update — not implemented
**Date:** 2026-07-13
**Finding:** `electron-updater` is NOT in `package.json` dependencies. No auto-update code exists anywhere in `src/`. The `electron-builder.yml` publish URL (`https://example.com/auto-updates`) is a placeholder.
**What's needed:**
1. Add `electron-updater` to dependencies
2. Set real update server URL (S3, GitHub Releases, or self-hosted)
3. Implement `autoUpdater` bootstrap in `src/main/index.ts`
**Status:** BLOCKER for commercial ship — users cannot receive patches without this.

---

### ForgejoAdapter stub
**Date:** 2026-07-13
**Finding:** `ForgejoAdapter.pushBuildOutcome` logs only — does not actually push to Forgejo.
**Impact:** Low for now — Forgejo is not live. No action needed before fork. Apply when Forgejo infra is built.

---

### Windows PTY — incomplete
**Date:** 2026-07-13
**Finding:** `pty-proxy.ts:7` has `TODO: Windows support — use named pipes`. PTY currently only works on Unix/macOS.
**Impact:** AgentHub on Windows will have broken terminal output. HIGH priority if targeting Windows at launch.

---

## Opeidos In-App Integration

### Opeidos workflow dropdown + auto-install — must build before commercial ship
**Date:** 2026-07-13
**Decision:** The core commercial value delivery mechanism requires a new in-app marketplace. This is not yet built anywhere in src/.
**Model:** LemonSqueezy webhook-driven install — payment confirmed → webhook fires → AgentHub downloads zip → extracts to `~/.claude/plugins/agenthub/workflows/[workflow-id]/` → skills panel auto-refreshes.
**What exists today:** `plugin-installer.ts` already copies `plugin/` to `~/.claude/plugins/agenthub/` at startup. The install pipeline foundation exists — needs extension for remote downloads.
**What needs to be built (16 new files, 4 phases, ~14-16 days):**

Phase 1 — Backend services:
- `src/main/services/marketplace-service.ts` — fetches Opeidos catalog via REST
- `src/main/services/workflow-downloader-service.ts` — downloads + extracts workflow zips
- `src/main/services/purchase-tracker-service.ts` — tracks installed workflows in DB
- `src/main/db/migrations/035-marketplace.sql` — `marketplace_workflows` table
- `src/main/db/migrations/036-marketplace-webhooks.sql` — `webhook_events` table

Phase 2 — Webhook handler + adapter:
- `src/main/ipc/marketplace-webhook-handler.ts` — receives LemonSqueezy webhook, HMAC-SHA256 verification, triggers download
- `src/main/adapters/opeidos-adapter.ts` — HTTP client for Opeidos catalog API

Phase 3 — UI:
- `src/renderer/src/components/marketplace/MarketplacePanel.tsx` — catalog grid
- `src/renderer/src/components/marketplace/MarketplaceDetailModal.tsx` — workflow detail + buy button
- `src/renderer/src/stores/marketplace-store.ts` — Zustand state
- `src/renderer/src/components/marketplace/WorkflowInstallProgress.tsx`
- Skills dropdown updated to show Opeidos badge on installed workflows

Phase 4 — Types + wiring:
- `src/shared/types/marketplace.types.ts`
- `src/shared/schemas/marketplace.schemas.ts`
- IPC channel additions in `ipc-channels.ts`
- Wire into `service-orchestrator.ts`

**Status:** MUST BUILD — this is the P0 feature for commercial AgentHub. Do not fork until design spec is approved.

---

## LLM Setup Wizard

### First-run wizard is mandatory for commercial ship — design complete
**Date:** 2026-07-14
**Decision:** A first-run LLM setup wizard is required before commercial distribution. Without it, non-technical users (the primary commercial target: 40-50y, AI-curious, no developer background) cannot use the product at all. The app currently has no onboarding for LLM connections — credentials are inherited silently from the shell environment. A new user who installs the app sees an empty model dropdown with no explanation, tries to spawn an agent, and encounters a raw `zsh: command not found: claude` error in the terminal. The S16 PATH_MISMATCH banner in `TerminalTab.tsx` is a post-failure hint, not a substitute for pre-flight onboarding.

**Current broken state (confirmed by codebase audit 2026-07-14):**
- `model-service.ts` always returns the 3 Claude models (static list) regardless of whether the CLI is installed or authenticated
- `OLLAMA_CLOUD_KEY`, `OLLAMA_HOST`, `OLLAMA_CLOUD_HOST` are captured at module load time — injecting credentials post-startup has no effect without a restart
- No `setupComplete` flag or any first-run detection exists
- Only recovery path: `TerminalTab.tsx` S16 banner after agent fails with `command not found`

---

### Wizard design — 5 providers, 3 core steps
**Date:** 2026-07-14

**Providers supported at commercial ship:**
1. Claude (subscription / OAuth — no API key required)
2. Claude API key (ANTHROPIC_API_KEY — pay per use)
3. Local AI — Ollama running on the user's machine
4. Cloud AI — Ollama Cloud (OLLAMA_CLOUD_KEY)
5. **GPT (OpenAI) — deferred to commercial fork** (see decision below)

**Wizard flow:**
```
[0] Silent detection pass (~800ms)
    - HTTP fetch localhost:11434/api/tags (Ollama)
    - Check process.env for ANTHROPIC_API_KEY, OLLAMA_CLOUD_KEY
    - Binary check for claude CLI (shell-free, see constraint below)
[1] Welcome screen — "Let's connect your AI" — single button
[2] Provider picker — 4 cards (outcome language, not tech labels)
    - "Use Claude — no setup needed"  [Most popular]
    - "Use Claude with an API key"    [Pay as you go]
    - "Run AI on this computer"       [Private]
    - "Cloud AI, your way"            [Powerful + Private]
    Cards pre-filled from detection pass (green dot = ready, amber = needs one step)
[3] Provider sub-flow (per selected card)
    - Claude OAuth: in-app webview BrowserWindow — no terminal
    - API key: text input + live test call
    - Ollama local: system browser to ollama.ai + polling loop; model picker (Fast/Balanced/Powerful cards, sizes in GB)
    - Ollama cloud: text input + live test call
[4] Connection test (animated, auto-advances on success)
[5] Success — "You're ready to build."
```

**UX principles (from UIUX senior review 2026-07-14):**
- Modal overlay over dimmed main app (not full-screen lockout)
- Thin 4px progress bar, no step counter
- Card tap = advance (no separate Next button)
- Outcome language on all cards — no jargon in primary layer
- Advanced toggle (bottom-left ghost link) reveals technical names, env var labels, URL overrides — persistent for developers
- Polling is silent: when Ollama comes online while the wizard is open, the UI advances automatically
- Success screen has no back button — arrival must feel like arrival

---

### Hard constraint: no shell, no terminal, no zsh assumption
**Date:** 2026-07-14
**Decision:** The wizard must never instruct a non-technical user to open a terminal. No `zsh -l -c` detection in the wizard flow.

**Why:** zsh is a developer shell. Non-tech users on Windows or Linux may not have it. The commercial target persona has never typed `npm install` and has no concept of a shell profile. Asking them to open a terminal is a permanent exit trigger.

**What the wizard uses instead:**
- Ollama detection: HTTP fetch to `localhost:11434/api/tags` (already shell-free in `model-service.ts`)
- Claude OAuth: in-app `BrowserWindow` webview for the login flow — user clicks "Sign in", browser opens in-app, they log in, wizard receives the callback. No `claude login` terminal command visible to the user.
- API keys: text input field in the wizard UI
- Binary detection (best-effort): `child_process.execFile` with absolute path guessing (`/opt/homebrew/bin/claude`, `/usr/local/bin/claude`) — NOT `zsh -l -c 'which claude'` which requires a shell

**Note:** The existing `agent-manager.ts` PTY spawning (`zsh -l`) is a separate concern — it runs agents, not the wizard. The wizard never touches PTY spawning.

---

### Hard constraint: model list must refresh live after auth — no restart required
**Date:** 2026-07-14
**Decision:** When a provider connects during the wizard, the model list must update immediately in the running app without requiring a restart.

**Why:** A user who authenticates Claude during the wizard and then sees an empty model picker will assume the wizard failed. The expected behaviour (from analogous apps: Spotify Connect, 1Password, Zoom) is that the UI updates the moment connection succeeds.

**Technical prerequisite (BLOCKER):** `model-service.ts` lines 5-7 capture `OLLAMA_CLOUD_KEY`, `OLLAMA_HOST`, `OLLAMA_CLOUD_HOST` as module-level constants at import time. This means injecting into `process.env` after startup has no effect on `fetchOllamaCloudModels()`. Must be fixed before wizard can work for Ollama Cloud:
- Move all `process.env.*` reads inside the function bodies of `fetchOllamaLocalModels()` and `fetchOllamaCloudModels()`
- After `WIZARD.SAVE_CREDENTIAL` IPC: main process injects into `process.env`, re-calls `listAllModels()`, pushes updated list to renderer via `MODELS.UPDATED` event

---

### Credential storage — safeStorage (Electron Keychain)
**Date:** 2026-07-14
**Decision:** API keys collected by the wizard are stored via `electron.safeStorage` (macOS Keychain / libsecret on Linux / DPAPI on Windows). Encrypted buffer stored as base64 in the settings table under `anthropic_api_key_enc` / `ollama_cloud_key_enc`.

**Why:** The Telegram sidecar already uses this exact pattern (`telegram-sidecar-service.ts` lines 44-48). Reuse the proven implementation. Plaintext SQLite storage is unacceptable for API keys.

**Fallback:** If `safeStorage.isEncryptionAvailable()` returns false, fall back to plaintext SQLite with an explicit visible warning. Never silently downgrade.

---

### New IPC surface required for wizard
**Date:** 2026-07-14
**New file:** `src/main/ipc/wizard.ipc.ts`

| Channel | Direction | Purpose |
|---|---|---|
| `WIZARD.DETECT_PROVIDERS` | invoke | Parallel detection of all providers, returns DetectionResult |
| `WIZARD.TEST_CONNECTION` | invoke | Live API test with a given key, returns ok/error |
| `WIZARD.SAVE_CREDENTIAL` | invoke | Encrypt via safeStorage, store in DB, inject into process.env |
| `WIZARD.MARK_COMPLETE` | invoke | Set setupComplete = true, stop polling |
| `WIZARD.PROVIDER_STATUS_CHANGED` | event (main→renderer) | Live polling updates pushed during wizard wait states |

**First-run trigger:** `setupComplete` flag in settings table. Missing or `false` at startup → open wizard. Set to `true` only on explicit user completion or skip. "Remind me later" sets a session-only in-memory flag (not persisted).

---

### Pre-build prerequisites for the wizard sprint
**Date:** 2026-07-14
In order of dependency:

1. **`model-service.ts` refactor** — move module-level env constants into function bodies (BLOCKER for Ollama Cloud live refresh)
2. **Credentials migration** — new `035-credentials.sql` or `_enc` suffix keys in settings table
3. **Verify Claude CLI auth detection** — empirically test what `claude` outputs when unauthenticated; default UX to always confirm sign-in rather than auto-detect to avoid false positives
4. **Modal vs separate window decision** — `WindowManager` already supports `BrowserWindow`; wizard can be a small dedicated window or a modal overlay in the main renderer

---

### GPT (OpenAI) — 5th provider card, deferred to commercial fork
**Date:** 2026-07-14
**Decision:** GPT will be added as a 5th provider card in the wizard when the commercial fork is created. Excluded from the dev repo wizard build.

**Implementation (when fork sprint opens):**
- 5th card: "Use ChatGPT" — OpenAI API key, `OPENAI_API_KEY`
- Same `safeStorage` credential pattern as the Anthropic API key path
- New `openai` provider branch in `buildSpawnEnv()` (`model-dispatcher.ts`)
- New static `OPENAI_MODELS` list in `model-catalog.ts` (GPT-4o, GPT-4o-mini, o3, o3-mini)
- Invocation path (Claude CLI proxy vs separate binary) to be decided at fork time

---

## OPTimaeus

### OPTimaeus is more complete than previously documented
**Date:** 2026-07-13
**Finding (verified by live agent investigation):**
- `services/prose_renderer.py` — FULLY IMPLEMENTED (2 modes: BRIEF + COUNCIL)
- `services/anamnesis_queue.py` — FULLY IMPLEMENTED (local SQLite queue + HTTP POST to port 9300)
- PDF export (`routers/export.py`) — STUB only (markdown works, PDF returns "install reportlab" note)
**Monetization readiness:** ~65%
**P0 blocker:** Anamnesis Service (external, port 9300) not built. OPTimaeus queues writes locally but cannot close the cascade loop.

### Anamnesis — exists but silent
**Date:** 2026-07-13
**Status:** Anamnesis write layer IS scaffolded in OPTimaeus. It queues to local SQLite when port 9300 is unreachable. The Anamnesis service infrastructure itself (the receiver at port 9300) does not yet exist.
**Impact:** OPTimaeus operates as standalone. The full cascade (write to Anamnesis → OPTimaeus reads context) is designed but not operational.
**Decision:** OPTimaeus can launch as standalone (local-only, no cascade) before Anamnesis is built. Market positioning: "sovereign evaluation, local-first". Cascade closes when Anamnesis infrastructure is built.
