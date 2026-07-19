---
name: agenthub-expert
description: AgentHub feature oracle — instant status report of what is built, what is missing, and what must be done before commercial launch. Covers features, plans, monetization gaps, and pre-ship checklist.
category: intelligence
---

# AgentHub Expert

On-demand status snapshot of AgentHub (Hephaestus) — what is built, what is planned, what is blocking commercial launch.

## When to Use

- "What is the status of AgentHub?"
- "What does AgentHub still need before we can sell it?"
- "What plans are ready to implement for AgentHub?"
- "Is AgentHub monetization-ready?"
- Any question about AgentHub features, gaps, or roadmap

## What You Need Before Starting

No external input required. Read from:
- `src/main/services/` — backend features
- `src/renderer/src/` — frontend features and stores
- `docs/superpowers/plans/` — pending plans and their Status fields
- `package.json` — version, build targets
- `electron-builder.yml` — signing and update config
- Check for: `LICENSE`, `EULA.md`, first-run wizard, E2E tests

## Known Baseline (as of 2026-07-13 — verify before citing)

**Version:** 1.0.0 | **Platform:** macOS, Windows, Linux | **DB migrations:** 34 applied

### Built and Working
- Agent lifecycle management (agent-manager.ts, pty-proxy.ts)
- Model routing (model-dispatcher.ts, model-service.ts)
- Voice pipeline: STT via Whisper CLI, TTS via Piper (voice-service.ts, piper-service.ts)
- Git integration (git-service.ts — status, log, commit, branch)
- Docker + container management (docker-service.ts, container-manager.ts)
- Telegram sidecar bot (telegram-sidecar-service.ts, socket, queue)
- Skills system (skills-service.ts — discovery, execution, display registry)
- Kanban board with sprint intake (tasks DB, task_events, task_dependencies)
- Brain panel with status filtering (brain-scanner.ts, brain-entries DB)
- Breakout terminals + settings sync (window-manager.ts, settings-service.ts)
- Claude Code plugin auto-installer (plugin-installer.ts)
- Recovery system (recovery-manager.ts, snapshot-engine.ts)
- Health monitoring + auto-pause (health-monitor.ts, auto-pause.ts)
- Quality pipeline + guardrails (quality-pipeline.ts, guardrails-manager.ts)
- Activity log + usage tracking
- 35 frontend widget directories under src/renderer/src/widgets/
- 15 Zustand stores
- 28 IPC handler channels
- 104 test files (vitest + real better-sqlite3, no vi.mock abuse)
- Anamnesis write layer: scaffolded as llm-agent-service.ts + anamnesis-writer.ts — dormant

### Plans Ready to Implement
| Plan file | Feature |
|---|---|
| 2026-07-08-live-model-catalog.md | Wire fetchOllamaCloudModels() into listAllModels() |
| 2026-07-07-agenthub-claude-plugin.md | Claude Code plugin full wiring |
| 2026-07-06-brain-status-filter.md | Auto-computed brain status filter |
| 2026-07-06-skills-dropdown-redesign.md | Skills dropdown grid + search |
| 2026-07-06-llm-mirror.md | LLM Mirror debug/demo mode |
| 2026-06-24-sprint-intake.md | Two-file sprint output + draft persistence |
| 2026-06-29-token-optimizer.md | Token optimizer integration |

### Monetization Gaps (pre-ship checklist)
| Item | Severity | Status |
|---|---|---|
| LICENSE file | BLOCKER | Missing — no LICENSE at repo root |
| Code signing (macOS) | BLOCKER | notarize: false in electron-builder.yml |
| Auto-update server | BLOCKER | URL placeholder only (https://example.com/auto-updates) |
| EULA / Terms of Service | BLOCKER | Not created |
| First-run wizard | HIGH | No guided setup — cold start is broken |
| E2E test suite | HIGH | No Playwright/Cypress suite |
| Test coverage reporting | MEDIUM | No c8/nyc/vitest coverage configured |
| Installer wizard screens | MEDIUM | NSIS defaults only, no custom welcome/license screens |

## Workflow

1. Read `package.json` for current version and build targets
2. Glob `src/main/services/*.ts` — count and list services
3. Glob `src/renderer/src/widgets/` — count and list components
4. Glob `docs/superpowers/plans/*.md` — read Status field from each (first 5 lines)
5. Check for: `LICENSE`, `EULA.md`, `electron-builder.yml` (notarize field)
6. Output structured report: BUILT / PLANNED / MONETIZATION-GAPS / PRE-SHIP CHECKLIST
7. Order pre-ship checklist by blocking severity (BLOCKER first)

## Output

Structured markdown report:
- Table: BUILT features by domain
- Table: PLANNED — plan file, feature, status
- Table: MONETIZATION-GAPS — item, severity, current state
- Pre-ship checklist ordered by severity

## Constraints

- Always verify against current file state — do not rely solely on baseline above
- Never claim a feature is "working" without confirming the file exists in src/
- If a plan file's Status field says "Implemented", mark it as BUILT not PLANNED
- Do not propose solutions — report state only. Recommendations go to ecosystem-orchestrator.
