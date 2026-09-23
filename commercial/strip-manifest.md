# Commercial Fork Strip Manifest
**Date:** 2026-07-13
**Instructions:** When creating `agenthub-commercial`, apply this manifest file by file.
**Labels:** KEEP | STRIP | REWRITE | REVIEW

---

## Root-Level Directories

| Directory | Action | Reason |
|---|---|---|
| `src/` | **KEEP** | All app code — the product |
| `build/` | **KEEP** | Icons and electron build assets |
| `resources/` | **KEEP** | Binary assets (piper, whisper, espeak) |
| `scripts/` | **KEEP** | Build and release scripts |
| `plugin/` | **PARTIAL** | See Plugin section below |
| `tests/` | **KEEP** | Test suite (sanitized — remove any test referencing internal business logic) |
| `docker/` | **KEEP** | Docker config for dev environment |
| `.vscode/` | **KEEP** | Editor config |
| `node_modules/` | **STRIP** | Regenerated on `npm install` |
| `out/` | **STRIP** | Build output — regenerated |
| `.claude/` | **STRIP** | Entire directory — all business intelligence |
| `docs/` | **STRIP** | Entire directory — all internal strategy and plans |
| `packages/` | **STRIP** | All packages migrate to llm-workflows-pckg |
| `.claire/` | **STRIP** | Internal security audit findings |
| `.llm/` | **STRIP** | Internal LLM role configs |
| `.bmad/` | **STRIP** | Internal dev tool |
| `.bmad-output/` | **STRIP** | Internal dev output |
| `.superpowers/` | **STRIP** | Internal |
| `global-claude/` | **STRIP** | Internal Claude config |
| `human/` | **STRIP** | Internal human task tracking |
| `memory/` | **STRIP** | Internal agent memory |
| `debug/` | **STRIP** | Internal debug output |
| `market-modeling-runs/` | **STRIP** | Internal research output |
| `workflow-team-library/` | **STRIP** | Internal workflows (if at root) |
| `templates/` | **REVIEW** | Check if needed for builds |

---

## Root-Level Files

| File | Action | Reason |
|---|---|---|
| `LICENSE` | **KEEP** | Required — update SASU name before ship |
| `electron-builder.yml` | **KEEP** | Build config — enable notarize, add signing |
| `package.json` | **KEEP** | Dependencies |
| `package-lock.json` | **KEEP** | Lock file |
| `tsconfig*.json` | **KEEP** | TypeScript config |
| `electron.vite.config.ts` | **KEEP** | Vite config |
| `eslint.config.mjs` | **KEEP** | Linting |
| `vitest.config.ts` | **KEEP** | Test config |
| `vitest.integration.config.ts` | **KEEP** | Test config |
| `.gitignore` | **KEEP** | Sanitize — update paths |
| `.editorconfig` | **KEEP** | Editor config |
| `.prettierrc.yaml` | **KEEP** | Formatting |
| `.prettierignore` | **KEEP** | Formatting |
| `.agenthub.yaml` | **KEEP** | Guardrails config — security boundary |
| `README.md` | **REWRITE** | Public-facing version — no internal architecture details |
| `VOICE_FAQ.md` | **REVIEW** | Likely part of in-app guide system — verify with `docs/how-to/`. If linked, rewrite as non-tech friendly (post-fork task, same as how-to). |
| `.env` | **STRIP** | Replace with `.env.example` (key names, empty values) |
| `features.md` | **STRIP** | Internal feature tracking |
| `agenthub-story.md` | **STRIP** | Internal narrative |
| `human-task.md` | **STRIP** | Internal task tracking |
| `dev-task.md` | **STRIP** | Internal |
| `.worktreeinclude` | **STRIP** | Internal dev tool |
| `test12`, `test6`, `Test4` | **STRIP** | Temporary test files |
| `EULA.md` | **KEEP** (create first) | Required before ship — does not exist yet |

---

## plugin/ Directory

### plugin/ root
| File | Action | Reason |
|---|---|---|
| `plugin/guard.md` | **KEEP** | Jailbreak safeguard — non-negotiable |
| `plugin/.claude-plugin/plugin.json` | **KEEP** (sanitize) | Plugin manifest — remove internal references |
| `plugin/context/builder-mode.md` | **REVIEW** | Check for internal references |

### plugin/hooks/
| File | Action | Reason |
|---|---|---|
| `plugin/hooks/hooks.json` | **KEEP** | Session hook config |
| `plugin/hooks/session-start` | **KEEP** | Session start hook |
| `plugin/hooks/run-hook.cmd` | **KEEP** | Hook runner |

### plugin/workflows/ — STRIP ALL
| Folder | Action | Reason |
|---|---|---|
| `plugin/workflows/business/` | **STRIP** | Internal business intelligence |
| `plugin/workflows/brain/` | **STRIP** | Internal — personal knowledge base, philosophy, energy docs |
| `plugin/workflows/marketing/` | **STRIP** | Internal marketing strategy |
| `plugin/workflows/data/` | **STRIP** | Internal data archival |
| `plugin/workflows/stats/` | **STRIP** | Internal statistical research |
| `plugin/workflows/market-modeling/` | **STRIP** | Moves to llm-workflows-pckg |
| `plugin/workflows/market-sim-prep/` | **STRIP** | Moves to llm-workflows-pckg |
| `plugin/workflows/memory/` | **STRIP** | Internal — personal meeting notes and references |
| `plugin/workflows/brainstorm/` | **STRIP** | Internal brainstorming |
| `plugin/workflows/tech-brainstorm/` | **STRIP** | Internal dev planning |

**No workflows are bundled in the commercial fork.** AgentHub ships with an empty skills panel (dev-stack team only). Users browse and install workflows from the Opeidos catalog directly inside the app after installation. Workflows are distributed by Opeidos, not bundled at install time.

The `plugin/workflows/` directory will be **empty** in the commercial fork. Opeidos-installed workflows write into this directory at runtime when a user installs them.

### plugin/commands/ — 169 files
**KEEP (security + basic dev team):**
| Command | Reason |
|---|---|
| `sec-devops.md` | Security auditor |
| `sec-insider-threat.md` | Insider threat auditor |
| `secrets-guardian.md` | Secrets specialist |
| `injection-analyst.md` | Injection specialist |
| `stealth-detector.md` | Stealth threat specialist |
| `incident-responder.md` | Incident responder |
| `lead-threat-defense.md` | Threat defense lead |
| `threat-scout.md` | Threat mapper |
| `git-commit.md` | Git commit format |
| `team.md` | Basic dev team orchestrator |
| `scout-backend.md` | Backend scout |
| `scout-frontend.md` | Frontend scout |
| `scout-integration.md` | Integration scout |
| `dev-backend.md` | Backend dev |
| `dev-frontend.md` | Frontend dev |
| `dev-integration.md` | Integration dev |
| `architect.md` | Architect |
| `troubleshooter.md` | Troubleshooter |
| `tester-backend.md` | Backend tester |
| `tester-frontend.md` | Frontend tester |
| `uiux-senior.md` | UIUX designer |
| `persona-nontechuser.md` | Non-tech user persona |

**KEEP (for the 4 commercial workflows — TBD):**
Commands belonging to the 4 chosen workflows (to be listed once workflows are defined)

**STRIP (all others — 140+ files):**
All business intelligence, internal ops, Optimaeus-specific agents:
agenthub-expert, ai-audit, ai-fix, ai-identity-analyst, ai-post-sprint, ai-pre-build, animation-engineer, automation-blueprint, behavioral-analyst, brand-architect, business-analyst, campaign-analyst, ceo-advisor, ceo-coaching-*, channel-strategist, competitive-intel-marketing, concept-explorer, config-auditor, constraint-analyst, content-builder, content-creator, conversion-reviewer, counter-legal-advisor, creative-director, data-architect, decision-modeler, destructuring-*, ecosystem-architect, edge-cost-analyst, emotion-ux, experience-architect, feature-architect, feature-investigator, framework-builder, full-code-review, geo-*, icon-*, idea-challenger, identity-*, impl-*, investment-curator, jailbreak-*, landing-copywriter, lead-design-research, lead-ecosystem, lead-identity, lead-jailbreak, lead-landing-lab, lead-legal-guardian, lead-scenario, lead-ui-builder, legal-scanner, llm-pckg-expert, llm-tester, market-researcher, market-sim-*, market-stats-researcher, marketplace-geo-specialist, memory-curator, message-architect, modelise*, moodboard-curator, onboarding-*, opportunity-analyst, optimaeus-expert, optimisation-strategist, pain-mapper, payment-flow-designer, persona-profiler, policy-writer, positioning-expert, product-researcher, project-navigator, prompt-optimizer, quant-analyst, readiness-analyst, risk-analyst, risk-assessor, risk-manager, risk-modeler, scenario-*, sr-backend, sr-frontend, strategist, strategy-advisor, synthesis-builder, team-ai-expert, team-brain, team-brainstorm, team-business, team-data, team-marketing, team-stats, team-tech-brainstorm, team-threat-defense (keep lead-threat-defense above), technical-geo-auditor, telegram-notify, trend-scout, ux-explorer, value-prop-architect, workflow-analyst

### plugin/skills/ — 40+ skill folders
**KEEP:**
| Skill | Reason |
|---|---|
| `plugin/skills/sec-insider-threat/` | Security — insider threat auditor |
| `plugin/skills/index.json` | Registry — starts empty (security only); Opeidos populates at runtime |
| `plugin/skills/index.md` | Registry — rewritten with generic language (S26 fix) |
| `plugin/skills/display-registry.json` | UI registry — starts empty; populated when user installs from Opeidos |

**STRIP (all others):**
app-scenario-modeler, external-source-to-strategy, full-code-review, graphic-identity-team, language-articulation, skill-creator, team-ai-expert, team-app-icon-builder, team-brain, team-brainstorm, team-business, team-ceo-coaching, team-data, team-design-research, team-dev-loop, team-ecosystem-status, team-geo-optimizer, team-impl-lead, team-jailbreak-red-team, team-landing-lab, team-legal-guardian, team-marketing, team-onboarding-engine, team-stats, team-tech-brainstorm, team-threat-defense, team-ui-builder, test-integrity-review, token-optimizer, trustworthy-sources, vibe-marketing-validation

---

## docs/ — STRIP ALL

| Folder | Action |
|---|---|
| `docs/ai-engineering/` | STRIP |
| `docs/brainstorm/` | STRIP |
| `docs/business-strategy/` | STRIP |
| `docs/business-version/` | STRIP |
| `docs/ceo-coaching/` | STRIP |
| `docs/graphic-identity/` | STRIP |
| `docs/how-to/` | **REWRITE (post-fork)** | Linked to in-app guide panel. Currently dev-oriented. Must be rewritten as non-tech friendly after fork is created. Verify `VOICE_FAQ.md` is part of the same guide system. Do not strip — this becomes the user help system. |
| `docs/learnings/` | STRIP |
| `docs/marketing/` | STRIP |
| `docs/superpowers/` | STRIP — plans, specs, security audits, strategy |
| `docs/todo-business/` | STRIP |
| `docs/token-reports/` | STRIP |
| `docs/ui-builder/` | STRIP |
| `docs/user-personality/` | STRIP |
| `docs/webresearch/` | STRIP |

---

## .claude/ — STRIP ENTIRE DIRECTORY

| Folder | Action | Reason |
|---|---|---|
| `.claude/commands/` | STRIP | 169 internal agent role definitions |
| `.claude/skills/` | STRIP | 40+ internal skills including business intelligence |
| `.claude/teams/` | STRIP | 24 team configurations |
| `.claude/workflow-team-library/` | STRIP | 22 internal workflow methodologies |
| `.claude/CLAUDE.md` | STRIP | Internal project instructions |
| `.claude/how-to-index.md` | STRIP | Internal index |
| `.claude/settings.json` | STRIP | Internal Claude Code settings |

---

## packages/ — STRIP ALL (migrate to llm-workflows-pckg)

| Package | Action | Destination |
|---|---|---|
| `packages/destructuring/` | STRIP | → `llm-workflows-pckg/packages/destructuring/` |
| `packages/market-modeling/` | STRIP | → `llm-workflows-pckg/packages-py/market-intelligence/` |
| `packages/market-sim-pkg/` | STRIP | → `llm-workflows-pckg/packages-py/market-intelligence/` |
| `packages/package-factory/` | STRIP | → `llm-workflows-pckg/packages/package-factory/` |
| `packages/package-ts-factory/` | STRIP | → merge into `llm-workflows-pckg/packages/package-factory/` |
| `packages/token-optimizer/` | STRIP | → `llm-workflows-pckg/packages/token-optimizer/` |

---

## .env — STRIP, replace with .env.example

```env
# AgentHub Environment Variables
# Copy this file to .env and fill in your values

# Ollama Cloud (optional — for cloud model routing)
OLLAMA_CLOUD_HOST=
OLLAMA_CLOUD_KEY=

# Auto-update server (Cloudflare R2 bucket URL — required for updates to work)
AGENTHUB_UPDATE_URL=

# Optional overrides
# OLLAMA_HOST=
# LOG_LEVEL=
```

---

## .claire/ — STRIP BOTH FILES

| File | Action | Reason |
|---|---|---|
| `.claire/sec-devops.md` | STRIP | Internal security audit findings — do not publish |
| `.claire/sec-insider-threat.md` | STRIP | Internal security audit findings — do not publish |

---

## .llm/ — STRIP ENTIRE DIRECTORY

| Folder | Action | Reason |
|---|---|---|
| `.llm/assembler/` | STRIP | Internal LLM config |
| `.llm/investigator/` | STRIP | Internal |
| `.llm/roles/` | STRIP | Internal role definitions |
| `.llm/schema/` | STRIP | Internal |
| `.llm/shared/` | STRIP | Internal |
| `.llm/sync/` | STRIP | Internal |
| `.llm/translator/` | STRIP | Internal |
| `.llm/index.ts` | STRIP | Internal |

---

## Things To Create Before Ship (not yet in repo)

| File / Change | Action | Notes |
|---|---|---|
| `EULA.md` | CREATE | Commercial distribution requirement — BLOCKER |
| `.env.example` | CREATE | Replace .env for commercial fork |
| `README.md` (public) | REWRITE | Remove all internal architecture references |
| `electron-builder.yml` → `appId` | FIX | Change `com.electron.app` → `com.optimaeus.agenthub` (or chosen bundle ID) |
| `package.json` → `author` | FIX | Change `"example.com"` → Optimaeus entity name |
| `package.json` → `homepage` | FIX | Change `"https://electron-vite.org"` → `"https://agenthub.app"` |
| `package.json` → `license` field | ADD | Add `"license": "SEE LICENSE IN LICENSE"` |
| `electron-builder.yml` → `publish.url` | FIX | Replace `https://example.com/auto-updates` with real update server URL |
| `electron-updater` | ADD to deps | Required for auto-update — not currently in package.json |
| Auto-update bootstrap in `src/main/index.ts` | IMPLEMENT | Calls `autoUpdater.checkForUpdatesAndNotify()` at startup |
| Opeidos marketplace (16 new files) | BUILD | Core commercial value delivery — see decisions.md Opeidos section |

---

## Pending Decisions (blocks completing this manifest)

| Decision | Status | Impact |
|---|---|---|
| SASU legal name | TBD — pending company registration | Required to finalize LICENSE and EULA |
| `docs/how-to/` + `VOICE_FAQ.md` rewrite | POST-FORK TASK | Rewrite as non-tech friendly after fork is created. Verify both are linked to in-app guide panel first. |
| Opeidos catalog integration inside AgentHub | TO DESIGN | UI/UX for browsing and installing workflows from within the app. Core value delivery mechanism for commercial users. |
