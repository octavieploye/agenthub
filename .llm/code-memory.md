# Code Memory — agenthub

> Last sync: 23a2921 | 2026-08-27 | coordinator
> Commits since last sync: 0

## Backend

- `kanban-orchestrator.ts` — hybrid event+poll FSM engine; 5-phase pipeline (dev→review→security→commit→push); 30s tick; stuck-task detection (30min threshold); concurrency-capped agent dispatch; single-task pipeline (S2: run-single-task IPC); Ollama-Cloud health check + retry before dispatch (S3); date-trigger integration (S4); depends on dependency-solver, model-dispatcher, orchestrator-events, execution-summary-builder, ollama-cloud-health, date-watcher
- `anamnesis-reader.ts` — read-only HTTP client for Anamnesis lifecycle API; fetches metrics, layer distributions, history, archived records, policies; auth via X-Optimaeus-Caller + Bearer
- `anamnesis-mcp` — 18 MCP tools for agent Anamnesis access (remember, learn, record_procedure, record_constellation, record_shadow, record_intelligence + 12 read/utility tools); configured in .claude/settings.json; caller=hephaestus; permission=read+write_new; machine-enforced gate (gate.py) on all writes; replaces bash curl in anamnesis-write skill (2026-08-27)
- `anamnesis-writer.ts` — AUTOMATIC task event pipeline (Electron-side direct HTTP); circuit breaker + batching; routes CARD_TRANSITION/CARD_COMPLETED/SPRINT_INTAKE/ORCHESTRATOR_* events to Anamnesis episodic/procedural layers. Agent knowledge writes now go through MCP tools instead.
- `terminal-manager.ts` — WebGL glyph atlas refresh + auto-recovery after heavy terminal output (commit c321fca)
- `model-dispatcher.ts` — recommends model+provider per orchestrator phase (dev/review/security/commit/push)
- `date-watcher.ts` — DateWatcherService; scans tasks for date-based triggers (scheduled_at); fires orchestrator dispatch when date conditions met (S4)
- `sprint-watcher.ts` — extended with model selector scheduling indicators (S5)
- `helpers/ollama-cloud-health.ts` — Ollama Cloud availability probe; 5-attempt retry with exponential backoff; pre-dispatch health gate (S3)
- `helpers/retry.ts` — generic retry helper with configurable attempts + backoff (S3)
- `helpers/model-validator.ts` — validates model availability against cloud-models registry (S1)
- `orchestrator-events.ts` — EventEmitter bridge; agents emit OrchestratorAgentEvent, orchestrator subscribes
- `helpers/dependency-solver.ts` — resolves task dispatch order from blocker graph; returns dispatchable (unblocked) tasks
- `helpers/conflict-checker.ts` — detects file-level conflicts between concurrent agent tasks
- `helpers/execution-summary-builder.ts` — aggregates phase logs into ExecutionSummary with issues + debt flags
- `helpers/severity-classifier.ts` — classifies orchestrator issues into critical/high/medium/low
- `lifecycle.ipc.ts` — IPC handlers for Memory Health Tab (metrics, history, archives, policies, restore, trigger-cycle)
- `orchestrator.ipc.ts` — IPC handlers for orchestrator start/pause/resume/status/phase-history + push events
- `agent-manager.ts` — injects AGENTHUB_HOME env into every PTY session; appends agenthub CLAUDE.md via --append-system-prompt-file when CWD differs from agenthub (commit 3e9d79c); cross-repo-context.md instruction layer (commit 171fb78); writeMcpConfig() merges settings.json mcpServers + agenthub-telegram into per-agent temp config (commit 23a2921)
- `agent-mcp-config.ts` — readSettingsMcpServers(settingsPath): reads mcpServers block from .claude/settings.json; returns {} on any error; pure I/O function (no Electron deps); used by writeMcpConfig in agent-manager (commit 23a2921)
- `skills-service.ts` — isolated project/agenthub scans with independent try/catch; .md skills support command override; ux-challenge added to WORKFLOW_CATEGORIES (commit 3e9d79c)
- `kanban-orchestrator.ts` — security gate (sec-devops scan before commit phase); loop-back on security failures; phase profiles (dev/review/security model routing); NEUTRALISED 2026-08-26 until safeguards added (commits 283d2bc, 860038f)
- `sprint-watcher.ts` — auto-scan docs/sprints/ for sprint intake JSON files; extended test coverage (commit 7a4f7dc)
- `helpers/phase-profile.ts` — per-phase model/provider routing profiles for orchestrator (commit 283d2bc)
- `helpers/security-output-parser.ts` — parses sec-devops output into structured findings with severity (commit 283d2bc)
- `service-orchestrator.ts` — wires security gate + phase profiles into orchestrator startup (commit 283d2bc)
- `orchestrator-rules.ts` — S7: GUARDRAIL_PROMPTS for dev/review/security phases (anti-injection fencing with [TASK CONTENT START/END] markers); OPERATING_RULES (phaseOrder, maxPhaseRetries:3, limits.maxAgents:6, limits.maxWallClockMs:4h) — single source of truth read by orchestrator + monitor (commit f08d81a)
- `orchestrator-settings.ts` — runtime orchestrator settings store (commit f08d81a)
- `orchestrator-monitor.ts` — S6: independent rules-based safety monitor; 30s poll; enforces maxAgents, maxWallClock (4h), maxTokens (2M per run), stuckLoop (≥3 review-phase failures for same task); on breach: pauses run + Telegram alert; no LLM calls (commit f08d81a)
- `pre-launch-pipeline.ts` — pre-launch gate before orchestrator start; extended with Codex pre-checks (commit f08d81a)
- `quota-scrape-scheduler.ts` — scrapes provider quotas every 15 days; 60s defer on startup; 6h recheck interval; stores last scrape ISO in settings key `quota_last_scrape`; injected scrapeFn runs the 3 scrapers (commit 43f346a)
- `scrapers/claude-dashboard-scraper.ts` — Claude.ai dashboard quota scraper via BrowserClient (Chrome DevTools MCP); returns DashboardQuota {used, limit, percent, resetDate, scrapedAt} (commit 43f346a)
- `scrapers/codex-dashboard-scraper.ts` — Codex dashboard quota scraper; same BrowserClient interface (commit 43f346a)
- `scrapers/ollama-cloud-scraper.ts` — Ollama Cloud quota scraper; same BrowserClient interface (commit 43f346a)
- `scrapers/scraper-types.ts` — BrowserClient interface (navigate+evaluate) + DashboardQuota + ScraperResult types; tests mock BrowserClient (commit 43f346a)
- `parsers/codex-output-parser.ts` — CodexCliOutputParser implementing CliOutputParser; 4096-char rolling buffer; detects: awaiting_approval (highest priority) → rate_limited → completed → locked → busy; 45s startup grace; looping = 25 locked transitions in 30s window (commit 0b86888)
- `agents-md-generator.ts` — generateAgentsMd(): builds AGENTS.md for Codex CLI agents at spawn time; requires guard file containing 'I cannot assist with that request' phrase (integrity check); embeds: guard policy + skills index + CLAUDE.md + task description; canary marker `Hey!Master-Optimaeus!(canary)` (commit 0b86888)
- `codex-command-builder.ts` — builds Codex CLI spawn command args (commit a70b638)
- `codex-health.ts` — Codex CLI availability health check (commit a70b638)
- `codex-mcp-config.ts` — writes per-session MCP config for Codex agents (commit a70b638)
- `codex-session-reader.ts` — reads Codex CLI session output/state (commit a70b638)

## Frontend

- `orchestrator-store.ts` — Zustand store for orchestrator state; start/pause/resume actions; push-event listeners for status+phase changes; phase history fetching on popover open; single-task run action (S2); retry failure fetching + Ollama-Cloud status (S3); extended with rate-limit + safeguard state (commit f08d81a)
- `usage-store.ts` — Zustand store for provider quota/usage data from scrapers; consumed by RateLimitPrompt + SpawnDialog (commit 43f346a)
- `RateLimitPrompt.tsx` — widget shown when active provider hits rate limit; suggests fallback providers; wired to usage-store (commit cf34e26)
- `PreLaunchCard.tsx` — extended with Codex provider option + pre-launch pipeline status display (commit a70b638)
- `SpawnDialog.tsx` — extended with Codex CLI spawn option; reads usage-store for quota indicators (commit a70b638)
- `lifecycle-store.ts` — Zustand store for Memory Health; fetches lifecycle metrics, history, archived records, policies from Anamnesis reader via IPC
- `OrchestratorControls.tsx` — start/pause/resume buttons + status badge + progress bar for active orchestrator run
- `KanbanCardPopover.tsx` — expanded with phase history timeline per task; fetches on open; model selector + scheduling date display (S5)
- `KanbanCard.tsx` — phase status indicators; single-task run button (S2); scheduled_at badge (S1); model/scheduling indicators (S5)
- `KanbanBoard.tsx` — single-task run wiring (S2)
- `RetryFailureToast.tsx` — toast notification for Ollama-Cloud retry failures (S5)
- `MemoryHealthPanel.tsx` — tabbed panel (Overview / Archive / Policies) for Anamnesis lifecycle visibility
- `ArchiveBrowser.tsx` — paginated archive record viewer with restore action
- `ConsolidationSummary.tsx` — consolidation cycle stats display
- `HealthBadge.tsx` — healthy/warning/critical status indicator
- `LayerCard.tsx` — per-layer memory distribution card (total/active/archived/vectors)
- `MemoryRefreshButton.tsx` — manual refresh trigger for lifecycle metrics
- `SABar.tsx` — wired Memory Health Tab entry point
- `useVoiceInput.ts` — startingRef guard + robust unmount cleanup; relaxed stopListening guard (voice leak fix) (commit ae7952b)
- `audio-recorder.ts` — cancelled flag releases late-acquired getUserMedia stream on stop/unmount (voice leak fix) (commit ae7952b)

## DB/Migrations

- `036-orchestrator-runs.sql` — orchestrator_runs table (id, sprint_name, project_id, repo_id, status, concurrency_cap, telegram_notify, timestamps)
- `037-orchestrator-task-log.sql` — orchestrator_task_log table (id, run_id, task_id, phase, status, agent_id, model_used, provider_used, summary_json, issues_json, timestamps)
- `038-task-scheduling.sql` — adds scheduled_at, scheduling_rule, model_preference columns to tasks table (S1)
- `039-retry-failures.sql` — retry_failures table (id, run_id, task_id, provider, model, error, attempt, timestamps) (S3)
- `040-fix-stale-model-ids.sql` — updates stale Anthropic model IDs (claude-3-5-sonnet → claude-sonnet-4-5 etc.) in agent_history and snapshots tables (commit 314497b)
- `041-codex-provider.sql` — adds 'openai-codex' to tasks.provider_override CHECK constraint via table rebuild (SQLite cannot ALTER CHECK); valid values: anthropic | ollama-local | ollama-cloud | openai-codex
- `042-orchestrator-audit.sql` — adds started_by TEXT + trigger_source TEXT (manual|date-watcher|sprint-watcher|single-task) to orchestrator_runs
- `043-orchestrator-task-ids.sql` — adds task_ids_json TEXT to orchestrator_runs (explicit task list for sprint-scoped dispatch)
- Next migration: 044

## Integration

- `register-all.ts` — registers orchestrator.ipc + lifecycle.ipc handlers
- `service-orchestrator.ts` — wires KanbanOrchestrator + AnamnesisReader into service graph; injects agentManager, db, mainWindow dependencies
- `preload/index.ts` — exposes orchestrator + lifecycle IPC channels to renderer
- `ipc-channels.ts` — added ORCHESTRATOR_* (start/pause/resume/status/phase-history) + LIFECYCLE_* (metrics/history/archives/policies/restore/trigger-cycle) channels

## Testing

- `orchestrator.queries.test.ts` — 446-line query-level tests for orchestrator DB layer
- `kanban-orchestrator.test.ts` — unit tests for FSM lifecycle, phase transitions, stuck detection
- `kanban-orchestrator-integration.test.ts` — 501-line integration tests for full orchestrator flow
- `dependency-solver.test.ts` — blocker graph resolution tests
- `conflict-checker.test.ts` — file conflict detection tests
- `execution-summary-builder.test.ts` — summary aggregation tests
- `severity-classifier.test.ts` — severity classification tests
- `model-dispatcher.test.ts` — model recommendation tests
- `orchestrator-events.test.ts` — event bridge tests
- `anamnesis-writer.test.ts` — payload transformer tests updated
- `agent-mcp-config.test.ts` — 5 tests for readSettingsMcpServers (commit 23a2921)
- `orchestrator-monitor.test.ts` — rules-based monitor: concurrent-agents, duration, token, stuck-loop breach scenarios (commit f08d81a)
- `orchestrator-e2e.test.ts` — end-to-end orchestrator flow test (commit f08d81a)
- `pre-launch-pipeline.test.ts` — pre-launch gate tests (commit f08d81a)
- `quota-scrape-scheduler.test.ts` — shouldScrape() + scheduler start/stop tests (commit 43f346a)
- `rate-limit-cascade.test.ts` — reactive cascade trigger tests (commit cf34e26)
- `codex-output-parser.test.ts` (in parsers/) — CodexCliOutputParser state detection tests (commit 0b86888)
- `codex-skill-injection.test.ts` — AGENTS.md guard integrity + content tests (commit 0b86888)
- `codex-spawn.test.ts` — Codex CLI spawn tests (commit a70b638)
- `codex-health.test.ts` — Codex health check tests (commit a70b638)
- `codex-mcp-config.test.ts` — Codex MCP config generation tests (commit a70b638)
- `codex-session-reader.test.ts` — Codex session reader tests (commit a70b638)
- `agents-md-generator.test.ts` — generateAgentsMd() tests including guard integrity check (commit 0b86888)
- `scrapers/claude-dashboard-scraper.test.ts` — claude scraper with mocked BrowserClient (commit 43f346a)
- `scrapers/codex-dashboard-scraper.test.ts` — codex scraper tests (commit 43f346a)
- `scrapers/ollama-cloud-scraper.test.ts` — ollama cloud scraper tests (commit 43f346a)
- `PreLaunchCard.test.tsx` — pre-launch card component tests (commit a70b638)
- `RateLimitPrompt.test.tsx` — rate limit prompt component tests (commit cf34e26)

## Infrastructure

- No infra changes in this sync window

## Skills

- `team-ux-challenge` — upgraded to full-site audit + per-page loop (commit 447e259)
- `full-code-review` — refactored from 7-phase audit+fix to 2-phase review-only; named agents (architect + sr-backend + sr-frontend); scope-aware chained/standalone detection; 6 issue categories (commit 4ffadcc)
- `team-impl-lead` — refactored from 7 phases to 3; light/dev/full modes; chained/standalone scope; stack gate parallel with scouts; 2 output files (commit 4ffadcc)
- `impl-scout-content` — added project-type parameter (commercial=full 8-section, internal=docs+compliance only) (commit 4ffadcc)
- Cross-repo: 25 team-*.md command stubs added to plugin/commands/ + cross-repo-context.md instruction file (commit 171fb78)
- `team-sprint-planner/SKILL.md` — code-reviewer role clarified + sprint-planner gates synced (commit 78cd041)

## Shared Types

- `orchestrator.types.ts` — OrchestratorRun, OrchestratorTaskLog, OrchestratorIssue, OrchestratorDebtFlag, ExecutionSummary, OrchestratorStartInput, OrchestratorStatusResponse, push-event payloads, RetryFailure (S3); extended with started_by + trigger_source + task_ids fields (commits 042/043)
- `codex-health.types.ts` — CodexHealthStatus type
- `lifecycle.types.ts` — LayerDistribution, LifecycleMetrics, LifecycleHistoryEntry, ArchivedRecord/Page, PolicyUpdateRequest/Response, LifecycleRunResult, RestoreResult
- `ipc.types.ts` — orchestrator + lifecycle + single-task-run (S2) + retry-failures (S3) IPC type signatures
- `task.types.ts` — scheduled_at, scheduling_rule, model_preference fields (S1); category field (S5)
- `cloud-models.ts` — static cloud model registry with provider/tier metadata (S1); stale Anthropic model IDs fixed (commit 314497b)
- `category-classifier.ts` — task category classification for model selection (S1)
- `ipc-channels.ts` — added ORCHESTRATOR_DISPATCH (commit 283d2bc); added USAGE_* channels for quota/scraper data + RATE_LIMIT_* channels for cascade notifications (commits 43f346a/cf34e26)
- `model-catalog.ts` (constants) — extended with Codex provider entry (commit a70b638)
