# AgentHub — Commercial Build Status
**Last updated:** 2026-07-14
**Read this first. Every agent dropped into this context reads this before touching any file.**

> This file is deleted in the Phase 6 pre-ship checklist, before the first release build of `agenthub-commercial`.

---

## What this context is

You are in the **dev repo** (`hephaestus` / `agenthub`). This is the private operational hub. It is not what ships to users.

What ships is `agenthub-commercial` — a clean fork containing only `src/`, build config, and a stripped `plugin/`. That fork does not exist yet. You build here first. The fork is created only when the pre-fork checklist below is fully green.

**Entity name:** Hephaestus. Path: `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub`.

---

## Overall readiness: ~55% toward commercial ship

AgentHub `src/` is feature-complete for the core product (~90% of the code). The remaining work is commercial infrastructure that does not exist yet: the LLM setup wizard, the Opeidos marketplace, branding fixes, and signing/notarization.

| Layer | Status |
|---|---|
| Core app (`src/`) | DONE — feature-complete |
| `plugin/guard.md` jailbreak safeguard | DONE — active and wired |
| LICENSE (proprietary) | DONE — draft, needs SASU name |
| EULA | DONE — draft, needs legal review |
| LLM setup wizard | NOT BUILT |
| Opeidos marketplace integration | NOT BUILT |
| Branding/metadata fixes | NOT DONE |
| macOS notarization | NOT DONE (`notarize: false`) |
| Windows EV code signing | NOT DONE |
| `electron-updater` + auto-update | NOT DONE |
| Commercial fork (`agenthub-commercial`) | DOES NOT EXIST YET |

---

## What to build next — in this exact order

### 1. LLM Setup Wizard (build in dev repo)

**Why first:** Without this, non-technical users (the primary commercial buyer) see an empty model dropdown and a `zsh: command not found: claude` error on first spawn. There is no onboarding. The app is unusable for the target persona out of the box.

**Design:** Fully specified in `commercial/decisions.md` → section "LLM Setup Wizard".

Key facts an agent needs:
- 5 providers: Claude (OAuth), Claude API key, Ollama local, Ollama Cloud, GPT (deferred to commercial fork)
- 5-step flow: silent detection → welcome → provider picker → sub-flow → success
- **BLOCKER:** `model-service.ts` lines 5–7 capture `OLLAMA_CLOUD_KEY`, `OLLAMA_HOST`, `OLLAMA_CLOUD_HOST` as module-level constants at import time. These must be moved inside function bodies before the wizard can do live model refresh after credential injection.
- Credentials → `safeStorage.encryptString()` via Electron Keychain. Same pattern as `telegram-sidecar-service.ts:44-48`. Never plaintext SQLite.
- No shell, no terminal, no `zsh -l` in wizard flow. Binary detection uses absolute path guessing (`/opt/homebrew/bin/claude`), not `which`.
- New IPC file: `src/main/ipc/wizard.ipc.ts` (5 channels: `WIZARD.DETECT_PROVIDERS`, `WIZARD.TEST_CONNECTION`, `WIZARD.SAVE_CREDENTIAL`, `WIZARD.MARK_COMPLETE`, `WIZARD.PROVIDER_STATUS_CHANGED`)
- First-run trigger: `setupComplete` flag in settings table. Missing or `false` → show wizard.
- Pre-requisites before sprint start: (a) `model-service.ts` env refactor, (b) `035-credentials.sql` migration, (c) empirical test of Claude CLI auth detection output.

---

### 2. Opeidos Marketplace Integration (build in dev repo)

**Why second:** This is the core commercial value delivery. AgentHub ships with no bundled workflows. Users browse and install from Opeidos inside the app. Without this, the commercial product has no differentiation from a free download.

**Sprint spec:** `commercial/sprint-first-launch-marketplace.md` — 9 phases, all questions answered.

**Security requirements (read before writing a single line):** `commercial/security-commercial.md`
- 6 CRITICAL items block implementation start. Read them.
- Key constraint: marketplace `.md` files must NEVER auto-inject via `--append-system-prompt-file`. Explicit user invocation from Skills dropdown only. A malicious `.md` auto-injected under `--dangerously-skip-permissions` is RCE.

**Opeidos API contract (backend dependency):** `commercial/opeidos-commercial.md`
- The Opeidos backend (separate project) must expose 9 endpoints before the paid path works.
- For Phase 1, all workflows are free and bundled — no live API dependency. Build phases 0–6 without needing Opeidos live.

**New files this sprint creates (22 files):**
```
src/main/db/migrations/035-onboarding-events.sql
src/main/db/migrations/036-workflow-reviews.sql
src/main/db/migrations/037-installed-workflows.sql
src/main/services/marketplace-service.ts
src/main/services/opeidos-auth-service.ts
src/main/services/onboarding-analytics-service.ts
src/main/ipc/marketplace.ipc.ts
src/main/ipc/auth.ipc.ts
src/renderer/src/widgets/onboarding-screen/OnboardingScreen.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowCard.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowReviewModal.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowFeedbackCard.tsx
src/renderer/src/widgets/onboarding-screen/DiscountUnlockModal.tsx
src/renderer/src/widgets/marketplace-panel/MarketplacePanel.tsx
src/renderer/src/widgets/cart-panel/CartPanel.tsx
src/renderer/src/widgets/auth-connect/OpeidsConnectBanner.tsx
src/renderer/src/stores/marketplace-store.ts
src/renderer/src/stores/auth-store.ts
src/renderer/src/stores/cart-store.ts
src/shared/types/marketplace.types.ts
src/shared/types/auth.types.ts
plugin/marketplace-catalog.json
```

**Modified files:**
```
src/shared/constants/ipc-channels.ts
src/main/index.ts            — deep link handler + agenthub:// protocol
src/main/services/skills-service.ts   — third origin (userData/workflows/)
src/main/services/service-orchestrator.ts
src/main/ipc/register-all.ts          — DO NOT FORGET — missing this = zero handlers
electron-builder.yml          — agenthub:// protocol registration
src/renderer/src/widgets/sa-bar/SABar.tsx
src/renderer/src/App.tsx
```

**Phase ordering is strict** — see `security-commercial.md` → "Phase Ordering Constraints".

**Migration note:** Check current highest migration number before adding 035. Run `ls src/main/db/migrations/` — migration 033 is the last known one (`033-agent-telegram-notify.sql`). Add 034 as a placeholder or verify it exists before numbering 035.

---

### 3. Branding / metadata fixes (apply before forking)

Fix in the dev repo so the commercial fork starts clean:

| File | Change |
|---|---|
| `electron-builder.yml` | `appId: com.electron.app` → `com.optimaeus.agenthub` |
| `package.json` | `author: "example.com"` → Optimaeus entity name |
| `package.json` | `homepage: "https://electron-vite.org"` → `https://agenthub.app` |
| `package.json` | Add `"license": "SEE LICENSE IN LICENSE"` |
| `electron-builder.yml` | Replace `publish.url: https://example.com/auto-updates` with real URL |
| `package.json` | Add `electron-updater` to dependencies |
| `src/main/index.ts` | Add `autoUpdater.checkForUpdatesAndNotify()` bootstrap |

**BLOCKER for auto-update:** `electron-updater` is not in `package.json`. No auto-update code exists anywhere in `src/`. Users cannot receive patches without this.

---

### 4. macOS notarization + Windows EV signing

**macOS:** `electron-builder.yml:36` has `notarize: false`. Gatekeeper blocks unsigned apps with "app is damaged" on macOS 15+. Requires Apple Developer account + `electron-notarize` + App Store Connect API key.

**Windows:** No EV signing configured. SmartScreen shows "Windows protected your PC" on every install — a trust killer for a tool that runs `--dangerously-skip-permissions`. EV cert required (OV certs no longer suppress SmartScreen since 2023).

**Full distribution context:** `commercial/installation-and-marketplace.md`

---

### 5. Commercial fork creation

Only after items 1–4 are done AND:
- EULA is through legal review
- LICENSE has the registered SASU entity name + SIREN
- Privacy Policy URL (`agenthub.app/privacy`) exists
- `skill-creator` UI lockout implemented (`"userVisible": false` in `display-registry.json`)
- Guard rules for `plugin/guard.md` updated to block skill/workflow creation

**How to create the fork:** Cherry-pick only `src/` commits to a fresh repo. Apply `commercial/strip-manifest.md` file-by-file.

---

## Pre-fork checklist

- [ ] LLM setup wizard built and tested
- [ ] Opeidos marketplace integration built (free-workflow path at minimum)
- [ ] `appId`, `author`, `homepage`, `license` fixed in `package.json` + `electron-builder.yml`
- [ ] `electron-updater` installed + auto-update bootstrap in `src/main/index.ts`
- [ ] Real `publish.url` in `electron-builder.yml`
- [ ] macOS notarization configured
- [ ] Windows EV code signing configured
- [ ] EULA finalized (legal review done)
- [ ] LICENSE updated with registered SASU name + SIREN
- [ ] Privacy Policy URL live
- [ ] `skill-creator` locked out in `display-registry.json`
- [ ] `plugin/guard.md` commercial rules appended
- [ ] `plugin/skills/index.md` rewritten (generic language — S26 fix, no Optimaeus branding)
- [ ] `commercial/` folder deleted (this folder, these files, before first release build)

---

## Key files in this folder

| File | What it contains |
|---|---|
| `decisions.md` | All strategic + technical decisions with context. Read this for LLM wizard design, legal decisions, package strategy, OPTimaeus status. |
| `sprint-first-launch-marketplace.md` | Full 9-phase marketplace build sprint: types, services, stores, UI, tests. All questions answered. |
| `security-commercial.md` | 6 CRITICAL + 12 HIGH + 4 MEDIUM security items. Must read before writing marketplace code. |
| `opeidos-commercial.md` | Opeidos backend API contract + 12 security requirements Opeidos must implement. |
| `strip-manifest.md` | File-by-file KEEP/STRIP/REWRITE table for creating the commercial fork. |
| `installation-and-marketplace.md` | macOS/Windows/Linux signing requirements + recommended build order rationale. |

---

## Constraints that apply here

- Max 3 active agents at once (dev-stack team)
- No commits to `.md` files — source files only (`.ts`, `.tsx`, `.json`, `.sql`)
- No mocking in tests — real integration paths. See CLAUDE.md testing philosophy.
- No changes to `.gitignore`
- `commercial/` folder is gitignored — never stage or commit it
- All agent responses start with "Hey! Master-Optimaeus"
