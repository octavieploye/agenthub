# Code Memory — agenthub

> Last sync: eecc65b | 2026-09-06 | coordinator
> Commits since last sync: 0

## Backend

- `kanban-orchestrator.ts` — hybrid event+poll FSM engine; 5-phase pipeline (dev→review→security→commit→push); 30s tick; stuck-task detection (30min threshold); concurrency-capped agent dispatch; single-task pipeline (S2: run-single-task IPC); Ollama-Cloud health check + retry before dispatch (S3); date-trigger integration (S4); depends on dependency-solver, model-dispatcher, orchestrator-events, execution-summary-builder, ollama-cloud-health, date-watcher; hybrid dispatch routing: B-1 (simple/synchronous), B-2 (code tasks — agent calls report_files_changed MCP, orchestrator reads files_changed_json from DB not PTY output), A (full pipeline); parseFilesChanged() REMOVED (commit 336bf5b); locked-status detection as task completion (commit 96ecf17); chains dependent tasks after single-task pipeline completes (commit 3b0c171); monitor Telegram spam fix (commit f13e793); recoverOrphanedState() called at startup (commit eecc65b)
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
- `agent-manager.ts` — injects AGENTHUB_HOME env into every PTY session; appends agenthub CLAUDE.md via --append-system-prompt-file when CWD differs from agenthub (commit 3e9d79c); cross-repo-context.md instruction layer (commit 171fb78); writeMcpConfig() merges settings.json mcpServers + agenthub-telegram into per-agent temp config (commit 23a2921); Codex spawn: resolves kanban script path (packaged vs dev) + db/socket paths, passes to ensureCodexMcpServers so agenthub-kanban is registered with Codex (commit 093b0d4); setMcpServerInfo(socketPath, socketToken) setter — writeMcpConfig injects agenthub-kanban with runtime socket path+token into every Claude agent spawn (commit 7ac786b); sendInput/resizeAgent: throw→log.warn+return on stale renderer references (graceful degradation, commit eecc65b)
- `agent-mcp-config.ts` — readSettingsMcpServers(settingsPath): reads mcpServers block from .claude/settings.json; returns {} on any error; pure I/O function (no Electron deps); used by writeMcpConfig in agent-manager (commit 23a2921)
- `skills-service.ts` — isolated project/agenthub scans with independent try/catch; .md skills support command override; ux-challenge added to WORKFLOW_CATEGORIES (commit 3e9d79c)
- `kanban-orchestrator.ts` — security gate (sec-devops scan before commit phase); loop-back on security failures; phase profiles (dev/review/security model routing); NEUTRALISED 2026-08-26 until safeguards added (commits 283d2bc, 860038f)
- `sprint-watcher.ts` — auto-scan docs/sprints/ for sprint intake JSON files; extended test coverage (commit 7a4f7dc); zero-click sprint intake automation: watches docs/sprints/ for new JSON files, auto-ingests as tasks, emits SPRINT_INTAKE_COMPLETED IPC push event (commit c6497aa)
- `helpers/phase-profile.ts` — per-phase model/provider routing profiles for orchestrator (commit 283d2bc)
- `helpers/security-output-parser.ts` — parses sec-devops output into structured findings with severity (commit 283d2bc)
- `service-orchestrator.ts` — wires security gate + phase profiles into orchestrator startup (commit 283d2bc)
- `orchestrator-rules.ts` — S7: GUARDRAIL_PROMPTS for dev/review/security/simple phases (anti-injection fencing with [TASK CONTENT START/END] markers); OPERATING_RULES (phaseOrder, maxPhaseRetries:3, limits.maxAgents:50, limits.maxWallClockMs:4h) — single source of truth read by orchestrator + monitor; GUARDRAIL_PROMPTS.simple updated: instructs B-2 agents to call report_files_changed MCP tool instead of printing FILES_CHANGED text marker; escalation ladder in dev+simple prompts (commit 336bf5b)
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
- `codex-health.ts` — Codex CLI availability health check (commit a70b638); ensureCodexMcpServers now registers 3 servers: anamnesis + agenthub-telegram + agenthub-kanban; gains kanbanScriptPath/dbPath/socketPath params (commit 093b0d4); always re-registers agenthub-kanban regardless of mcp list output (commit e0d662e); uses Electron binary path instead of `node` for kanban MCP server to avoid NODE_MODULE_VERSION mismatch (commit f6e223b)
- `codex-mcp-config.ts` — writes per-session MCP config for Codex agents (commit a70b638); ensureCodexMcpServers() merges Anamnesis + agenthub-telegram MCP server entries into Codex config at spawn time (commit a64abc6)
- `codex-session-reader.ts` — reads Codex CLI session output/state (commit a70b638)
- `agents-md-generator.ts` — extended: resolves @-imports in CLAUDE.md (reads referenced files and inlines content); wires project UUID to anamnesis-writer at generation time; injects cross-repo-context.md into Codex AGENTS.md at spawn (commits 19465d0, c782f8a)
- `anamnesis-writer.ts` — wires project UUID resolution; picks up project_id from agents-md-generator context (commit 19465d0)
- `helpers/model-validator.ts` — extended to accept 'openai-codex' provider; validates Codex model IDs against model-catalog CODEX_MODELS (commits 469f1a5, f26da5d)
- `service-orchestrator.ts` — real token attribution wired to orchestrator-monitor cap: token counts from agent output now flow to monitor.recordTokens() instead of placeholder zeros (commit 0e6b054)
- `agent-manager.ts` — invalid await removed from sync spawnAgent function; Anamnesis + Telegram MCP servers injected via ensureCodexMcpServers at Codex spawn (commits 5594b97, a64abc6)
- `skills-service.ts` — manifest YAML validation: validates triggers (array), resources (object), securitySensitive (boolean) at parse time; consolidated on 'yaml' package (eemeli/yaml v2), removed js-yaml dependency (S83/S84, commit c7b80be)
- `service-orchestrator.ts` — OLLAMA_URL env var with localhost:11434 fallback (S80); Telegram spawn_agent validates msg.repo against getAllRepos(db) before spawnAgent, rejects unregistered paths (S81, commit c7b80be)
- `telegram-socket-server.ts` — fail-fast on startup errors; exposes socket bridge health status; extended test coverage 111 lines (commit 400b329)
- `recovery-manager.ts` — surfaced interrupted agents in buildRecoveryInfo(); previously getAllAgents() silently excluded 'interrupted' status (commit c38c181)
- `auto-triage.ts` — rate_limited triage rule added; agents in rate_limited state now correctly triaged (commit cfd2391)
- `skill-classifier.ts` — maps task descriptions to SkillDomain + complexity level; entry point for skill dispatch pipeline Phase 0 (commit 079a6e2)
- `pipeline-composer.ts` — template-based execution plan assembly from SkillDomain + complexity; reads pipeline-templates registry (commit 079a6e2)

## Sprint Inventory — Anamnesis (mandatory pre-sprint check)

All sprint history is stored in Anamnesis (procedural + semantic layers). Before creating, dispatching, or planning any sprint, agents MUST query:
```
recall(query="sprint inventory for <repo-name>", domain="sprint_inventory")
```
- Procedural layer: full per-repo sprint records with status (done/partial/not_done), dates, living/target repos
- Semantic layer: voice-ready summary of all not-done + partial sprints across 9 repos
- Repos covered: agenthub, optimaeus, anamnesis, hephaestus, hephaestus-sovereign, optimaeus-llm, workflow-server-api, optimaeus-commercial, anamnesis-commercial
- Do NOT use local docs/sprints/ or docs/superpowers/plans/ as authoritative — Anamnesis is the single source of truth
- Kanban orchestrator queries this inventory before dispatching tasks
- Orchestrator status: ENABLED (orchestrator.enabled=true in settings DB); safeguards S1-S9 implemented
- `pipeline-templates.ts` — default template registry: code-dev, security-audit, legal-review (triggers corrected to domain:'legal', S82), devops-deploy (commits 079a6e2, c7b80be)
- `token-budget.ts` — per-skill token ceiling + adaptive learning; stores/reads token_usage table (migration 045); adjusts ceiling based on past runs (commit 079a6e2)
- `sprint-card-enricher.ts` — YAML manifest + pipeline plan enrichment; hooked into sprint-watcher.parseAndStage() flow at sprint intake (commit 079a6e2)
- `mcp-server/server.ts` — standalone MCP server process; shutdown() calls server.close() before process.exit (R-006); emits stderr WARN if dirname(AGENTHUB_DB_PATH) lacks package.json (R-007, commit 7e8412d); Phase 0-5 routing handlers wired (commit 079a6e2); tools: create_task, list_tasks, dispatch_task, dispatch_sprint, estimate_tokens, recommend_model, get_guardrails, get_skills, get_context, audit_deps, create_project, report_files_changed (commits f8089b9, 7777717, 336bf5b); get_skills accepts repoPath to include target repo skills (commit 19f9934); repo path allowlist on get_guardrails + get_skills (commit 7dc59a8); uses Electron binary (not node) for kanban MCP server (commit f6e223b)
- `mcp-server/db/read-connection.ts` — read-only SQLite connection for MCP server handlers; no Electron deps (commit 079a6e2)
- `mcp-server/engines/risk-calculator.ts` — pure-function 7-dimension risk scorer; R1: destructive pattern detection (33 ban-list entries, case-insensitive), R2: protected path matching, R3: supervised category without approval gate, R4: file count boundaries, R5: token budget (NaN guard), R6: missing description, R7: cross-directory scope; returns {riskScore, riskFactors, riskLevel}; no Electron/DB deps (commits a3038ce, 0a4deb6)
- `mcp-server/engines/token-estimator.ts` — token count estimation engine for skill dispatch (commit 079a6e2)
- `mcp-server/handlers/context-handlers.ts` — handleGetGuardrails() reads .agenthub.yaml + merges DEFAULT_GUARDRAILS (source: file|default); handleGetSkills() instantiates SkillsService with no-op logger, optional query filter, optional repoPath (commit 19f9934); handleGetContext() fires get_active_agents + get_orchestrator_status + get_health_anomalies in parallel → SelfAwarenessManifest; S3-T8 (commit d525726); handleReportFilesChanged() — client-side path validation + IPC sendIpc call → report_files_changed → main process writes to DB (commit 336bf5b)
- `mcp-server/handlers/model-handlers.ts` — model routing handlers; CapabilityTier union: 'frontier'|'expert'|'capable'|'efficient' ('standard' is NOT a valid tier — low-risk maps to 'capable', commit 079a6e2, ae46f34)
- `mcp-server/handlers/task-handlers.ts` — task read/write handlers for MCP server (commit 079a6e2)
- `mcp-server/handlers/deps-handler.ts` — dependency resolution handler for MCP server (commit 079a6e2)
- `mcp-server/ipc/ipc-protocol.ts` — IPC message type definitions for MCP server ↔ main process (commit 079a6e2)
- `mcp-server/ipc/parent-ipc.ts` — parent IPC bridge; MCP server sends requests to main process via stdin/stdout protocol (commit 079a6e2); connect/close lifecycle improved (commit 9f96267)
- `mcp-server/server.ts` — contextDeps wired: getRepos/getQuota/getSafeguards/getModelCatalog all injected (commit 9f96267)
- `mcp-server/db/read-connection.ts` — extended: listReposReadOnly(), getQuotaReadOnly(), getSafeguardsReadOnly() added (commit 9f96267)
- `mcp-server/handlers/task-handlers.ts` — aligned with updated McpIpcRequest routing (commit 9f96267)
- `mcp-server/handlers/deps-handler.ts` — aligned with updated routing (commit 9f96267)
- `mcp-server/ipc/ipc-protocol.ts` — McpIpcFrame / McpIpcResponseFrame types tightened (commit 9f96267)
- `mcp-server-manager.ts` — McpServerManager: owns main-process side of the MCP server connection; spawns server.ts as child process via Unix domain socket (tmpdir/agenthub-mcp-{pid}.sock); routes create_task/update_task/dispatch_task/dispatch_sprint/get_active_agents/get_orchestrator_status/get_health_anomalies/create_project/report_files_changed to db queries + orchestrator + healthMonitor; emits TASKS.UPDATED + ORCHESTRATOR.STATUS_CHANGE to renderer; error.code propagated so S5 BUDGET_CAP_REACHED path is live (commit 9a28599); wired as service 19 in service-orchestrator (commit 093b0d4); socket hardened: chmod 600 + MAX_CONNECTIONS=8 + AUTH_TIMEOUT_MS=5000 + unauthenticated tracking (commit a11f911); exposes getSocketToken() (commit 7ac786b); report_files_changed: path validation (no absolute, no .., ≤100 files, ≤260 chars), checks result.changes > 0 (throws NO_DEV_LOG if 0), writes files_changed_json to orchestrator_task_log via UPDATE subquery (commit 336bf5b)
- `brain-scanner.ts` — BrainScannerService: auto-discovers .md artifacts across all registered repos in 15 known directories (specs, plans, strategy, brainstorm, how-to, marketing, etc.); derives computed_status from checklist ticks + structured [Refs] git signals; auto-promotes active→implemented when done; registerBrainEntry() creates pointer file + db row; getTimeline() merges brain events + git log (commit 4cde8fd)
- `brain.ipc.ts` — registerBrainIpcHandlers(): BRAIN.QUERY (auto-discover + group by repo + summary counts), BRAIN.UPDATE_STATUS, BRAIN.REGISTER (Zod-validated), BRAIN.TIMELINE, BRAIN.CREATE_TASK (commit 4cde8fd)

## Frontend

- `orchestrator-store.ts` — Zustand store for orchestrator state; start/pause/resume actions; push-event listeners for status+phase changes; phase history fetching on popover open; single-task run action (S2); retry failure fetching + Ollama-Cloud status (S3); extended with rate-limit + safeguard state (commit f08d81a)
- `usage-store.ts` — Zustand store for provider quota/usage data from scrapers; consumed by RateLimitPrompt + SpawnDialog (commit 43f346a)
- `RateLimitPrompt.tsx` — widget shown when active provider hits rate limit; suggests fallback providers; wired to usage-store (commit cf34e26)
- `PreLaunchCard.tsx` — extended with Codex provider option + pre-launch pipeline status display (commit a70b638)
- `SpawnDialog.tsx` — extended with Codex CLI spawn option; reads usage-store for quota indicators (commit a70b638)
- `lifecycle-store.ts` — Zustand store for Memory Health; fetches lifecycle metrics, history, archived records, policies from Anamnesis reader via IPC
- `OrchestratorControls.tsx` — start/pause/resume buttons + status badge + progress bar for active orchestrator run; Codex model selector added; sprint intake trigger button added (commits f26da5d, b71e5d0, c6497aa)
- `KanbanDispatchModal.tsx` — Codex provider + model selection wired into dispatch payload; IPC schema updated (commits f26da5d, b71e5d0)
- `KanbanBoard.tsx` — real-time repo list sync via repos:list-updated IPC push; ProjectManagerModal + SprintIntakeModal both refreshed on repo change (commit a3054a5)
- `ProjectManagerModal.tsx` — listens for repos:list-updated IPC; refreshes repo list without full remount (commit a3054a5)
- `SprintIntakeModal.tsx` — same real-time repo sync as ProjectManagerModal (commit a3054a5)
- `KanbanCardPopover.tsx` — expanded with phase history timeline per task; fetches on open; model selector + scheduling date display (S5); Codex provider display + MCP metadata fields shown when present (commits 469f1a5, f26da5d, b71e5d0)
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
- `BreakoutLayout.tsx` — DB history replayed into fresh terminal on mount: fetches agent output from DB on first render and feeds into xterm buffer so breakout windows aren't blank (commit 7be8c5a)
- `brain-store.ts` — Zustand store for Brain Panel: refreshBrainData, registerBrainEntry, updateBrainEntryStatus (optimistic in-store update), createTaskFromBrainEntry, getTimeline; all wired to window.agentHub.brain.* preload channels (commit 4cde8fd)
- `RaidFrame.tsx` — updated (commit 9042d89)

## DB/Migrations

- `036-orchestrator-runs.sql` — orchestrator_runs table (id, sprint_name, project_id, repo_id, status, concurrency_cap, telegram_notify, timestamps)
- `037-orchestrator-task-log.sql` — orchestrator_task_log table (id, run_id, task_id, phase, status, agent_id, model_used, provider_used, summary_json, issues_json, timestamps)
- `038-task-scheduling.sql` — adds scheduled_at, scheduling_rule, model_preference columns to tasks table (S1)
- `039-retry-failures.sql` — retry_failures table (id, run_id, task_id, provider, model, error, attempt, timestamps) (S3)
- `040-fix-stale-model-ids.sql` — updates stale Anthropic model IDs (claude-3-5-sonnet → claude-sonnet-4-5 etc.) in agent_history and snapshots tables (commit 314497b)
- `041-codex-provider.sql` — adds 'openai-codex' to tasks.provider_override CHECK constraint via table rebuild (SQLite cannot ALTER CHECK); valid values: anthropic | ollama-local | ollama-cloud | openai-codex
- `042-orchestrator-audit.sql` — adds started_by TEXT + trigger_source TEXT (manual|date-watcher|sprint-watcher|single-task) to orchestrator_runs
- `043-orchestrator-task-ids.sql` — adds task_ids_json TEXT to orchestrator_runs (explicit task list for sprint-scoped dispatch)
- `044-task-mcp-metadata.sql` — adds 8 nullable columns to tasks: target_files_json, skills_json, guardrail_json, risk_factors_json, estimated_tokens, recommended_model, risk_score, created_by; wired through insertTask/updateTask/mapRow (MODIFIED in commit d36ce78 — original columns mcp_server/mcp_tool/etc. moved to types only)
- `045-token-usage.sql` — token_usage table for adaptive skill token ceiling tracking (commit 079a6e2)
- `046-token-usage-index.sql` — idx_token_usage_skill index on token_usage for efficient adaptive ceiling queries by skill_id (S85, commit c7b80be)
- `035-workflow-qc.sql` — workflow_qc_runs audit table (id, run_id, task_id, check_type, result, details_json, timestamps); added out-of-order (commit 5bf4544)
- `047-files-changed-task-log.sql` — adds files_changed_json TEXT (nullable) to orchestrator_task_log; written by report_files_changed MCP tool via routeRequest; read by getFilesChangedForTask() in B-2 dispatch path (commit 336bf5b)
- Next migration: 048

## Integration

- `db/queries/orchestrator.queries.ts` — mapTaskLogRow: gains filesChangedJson field; insertTaskLog return gains filesChangedJson: null; getFilesChangedForTask(db, taskId) — queries most recent dev-phase log for task, parses files_changed_json, Array.isArray guard before cast, returns [] on null/malformed/non-array (commit 336bf5b)
- `register-all.ts` — registers orchestrator.ipc + lifecycle.ipc handlers
- `service-orchestrator.ts` — wires KanbanOrchestrator + AnamnesisReader into service graph; injects agentManager, db, mainWindow dependencies; real token attribution to monitor cap (commit 0e6b054); sprint-watcher wired into startup (commit c6497aa); McpServerManager wired as service 19 after KanbanOrchestratorService with full deps; stop() in stopServices() (commit 093b0d4); startup orphan recovery: recoverOrphanedState() called after KanbanOrchestrator init, Telegram notification on stale runs + orphaned tasks reset (commit eecc65b)
- `preload/index.ts` — exposes orchestrator + lifecycle IPC channels to renderer; repos:list-updated push channel (commit a3054a5); sprint-intake-completed push channel (commit c6497aa)
- `ipc-channels.ts` — added ORCHESTRATOR_* (start/pause/resume/status/phase-history) + LIFECYCLE_* (metrics/history/archives/policies/restore/trigger-cycle) channels; added REPOS_LIST_UPDATED (commit a3054a5); added SPRINT_INTAKE_COMPLETED (commit c6497aa)
- `db.ipc.ts` — repos:list push handler: emits REPOS_LIST_UPDATED to renderer when repo table changes (commit a3054a5)

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
- `codex-health.test.ts` — Codex health check tests (commit a70b638); extended with ensureCodexMcpServers() tests for Anamnesis + Telegram MCP injection (commit a64abc6); updated for 3-server case (agenthub-kanban added, new params in all call sites) (commit 093b0d4)
- `skills-service.test.ts` — executeSkill() tests; command override field coverage (commit ed0c575)
- `tasks.queries.test.ts` — extended with MCP metadata column read/write tests (commit 469f1a5)
- `codex-mcp-config.test.ts` — Codex MCP config generation tests (commit a70b638)
- `codex-session-reader.test.ts` — Codex session reader tests (commit a70b638)
- `agents-md-generator.test.ts` — generateAgentsMd() tests including guard integrity check (commit 0b86888); extended with @-import resolution tests + cross-repo-context injection tests (commits 19465d0, c782f8a)
- `scrapers/claude-dashboard-scraper.test.ts` — claude scraper with mocked BrowserClient (commit 43f346a)
- `scrapers/codex-dashboard-scraper.test.ts` — codex scraper tests (commit 43f346a)
- `scrapers/ollama-cloud-scraper.test.ts` — ollama cloud scraper tests (commit 43f346a)
- `PreLaunchCard.test.tsx` — pre-launch card component tests (commit a70b638)
- `RateLimitPrompt.test.tsx` — rate limit prompt component tests (commit cf34e26)
- `risk-calculator.test.ts` — 94 tests for 7 risk dimensions; R1: all 33 ban-list entries + case-insensitivity, R2: protected paths (exact + prefix, false-prefix guard), R3: supervised category, R4: file count boundaries (3/4/10/11), R5: token budget + NaN guard, R6: missing description, R7: cross-directory scope; score clamping + riskLevel thresholds (commit a3038ce)
- `token-estimator.test.ts` — 368-line token estimation tests (commit 079a6e2)
- `model-handlers.test.ts` — 82 tests; CapabilityTier fix: 'standard' not valid, low-risk → 'capable' (commits 079a6e2, ae46f34)
- `skills-service-manifest.test.ts` — manifest YAML loading + validation coverage (commit 079a6e2)
- `sprint-card-enricher.test.ts` — 233-line enrichment pipeline tests (commit 079a6e2)
- `pipeline-composer.test.ts` — 241-line plan assembly tests (commit 079a6e2)
- `skill-classifier.test.ts` — 303-line domain/complexity detection tests (commit 079a6e2)
- `token-budget.test.ts` — 211-line per-skill token ceiling tests (commit 079a6e2)
- `telegram-socket-server.test.ts` — 111-line socket bridge health + fail-fast tests (commit 400b329)
- `anamnesis-writer.test.ts` — 417 lines; aligned with project registration flow (320 lines added, commit 3a5ddc7)
- `BreakoutLayout.test.tsx` — terminal widget mock contracts restored (52 lines added, commit c841e39)
- `FullTerminal.test.tsx` — mock contracts restored (commit c841e39)
- `mcp-server/db/read-connection.test.ts` — tests for listReposReadOnly, getQuotaReadOnly, getSafeguardsReadOnly (new, commit 9f96267)
- `mcp-server/handlers/task-handlers.test.ts` — task handler tests aligned with updated IPC routing (new, commit 9f96267); +6 safeguard tests: S4 confirmed:false→requires_confirmation, S5 BUDGET_CAP_REACHED→budget_cap_reached, S7 auto-inject protected paths + requiresApproval at riskScore≥0.7 (commit 9a28599)
- `mcp-server-manager.test.ts` — McpServerManager: start/stop lifecycle, socket routing, IPC request handling (new, commit 31d4ce7)
- `files-changed-mcp.test.ts` — 13 tests: handleReportFilesChanged path validation (absolute, .., >100, >260 chars, valid, IPC error); getFilesChangedForTask (null, valid JSON, nonexistent task, malformed JSON); routeRequest DB contract (SQL round-trip, no-call path, changes=0 signal) (new, commit 336bf5b)
- `047-files-changed-task-log.test.ts` — migration test: column nullable, JSON write/read (new, commit 336bf5b)
- `brain.ipc.test.ts` — 5 tests for QUERY/UPDATE_STATUS/REGISTER/TIMELINE/CREATE_TASK handlers (new, commit 4cde8fd)
- `brain.queries.test.ts` — brain queries DB test coverage (commit 4cde8fd)
- `brain-scanner.test.ts` — BrainScannerService unit tests (commit 4cde8fd)
- `RaidFrame.test.tsx` — updated mock contracts (commit 9042d89)
- `telegram.ipc.test.ts` — 1-test IPC contract (new, commit 9042d89)

## Infrastructure

- No infra changes in this sync window

## Skills

- `team-ux-challenge` — upgraded to full-site audit + per-page loop (commit 447e259)
- `full-code-review` — refactored from 7-phase audit+fix to 2-phase review-only; named agents (architect + sr-backend + sr-frontend); scope-aware chained/standalone detection; 6 issue categories (commit 4ffadcc)
- `team-impl-lead` — refactored from 7 phases to 3; light/dev/full modes; chained/standalone scope; stack gate parallel with scouts; 2 output files (commit 4ffadcc)
- `impl-scout-content` — added project-type parameter (commercial=full 8-section, internal=docs+compliance only) (commit 4ffadcc)
- Cross-repo: 25 team-*.md command stubs added to plugin/commands/ + cross-repo-context.md instruction file (commit 171fb78)
- `team-sprint-planner/SKILL.md` — code-reviewer role clarified + sprint-planner gates synced (commit 78cd041)
- `prompt-ready/SKILL.md` — new skill: generates ready-to-pass prompts for agent handoff (commit b5d15a5)
- `brainstorm-to-sprint/SKILL.md` — new skill: post-brainstorm meta-orchestrator; converts brainstorm output into sprint cards (commit b5d15a5)
- `voice-pipeline-coordinator/SKILL.md` — new skill: coordinates voice pipeline across TTS/STT/wake-word stages (commit b5d15a5)
- `memory-write-gate/SKILL.md` — DEPRECATED/simplified; gate logic moved to Anamnesis MCP machine-enforced gate (commit b5d15a5)

## Shared Types

- `orchestrator.types.ts` — OrchestratorRun, OrchestratorTaskLog, OrchestratorIssue, OrchestratorDebtFlag, ExecutionSummary, OrchestratorStartInput, OrchestratorStatusResponse, push-event payloads, RetryFailure (S3); extended with started_by + trigger_source + task_ids fields (commits 042/043); OrchestratorTaskLog gains filesChangedJson: string | null (commit 336bf5b)
- `codex-health.types.ts` — CodexHealthStatus type
- `lifecycle.types.ts` — LayerDistribution, LifecycleMetrics, LifecycleHistoryEntry, ArchivedRecord/Page, PolicyUpdateRequest/Response, LifecycleRunResult, RestoreResult
- `ipc.types.ts` — orchestrator + lifecycle + single-task-run (S2) + retry-failures (S3) IPC type signatures
- `task.types.ts` — scheduled_at, scheduling_rule, model_preference fields (S1); category field (S5); mcp_server, mcp_tool, mcp_args_json, deserialized_title/description/priority/tags typed fields added (Kanban MCP S1, commits 469f1a5, d22e048)
- `cloud-models.ts` — static cloud model registry with provider/tier metadata (S1); stale Anthropic model IDs fixed (commit 314497b)
- `category-classifier.ts` — task category classification for model selection (S1)
- `ipc-channels.ts` — added ORCHESTRATOR_DISPATCH (commit 283d2bc); added USAGE_* channels for quota/scraper data + RATE_LIMIT_* channels for cascade notifications (commits 43f346a/cf34e26)
- `model-catalog.ts` (constants) — extended with Codex provider entry (commit a70b638); real Codex model IDs + effort flag added; CODEX_MODELS exported and included in listAllModels() (commits ecdf3c0, 60ca4b8)
- `cloud-models.ts` — Codex model entries added to static cloud model registry (commit f26da5d)
- `skills.types.ts` — SkillItem gains command override field: custom CLI command to run instead of default skill invocation (commit ed0c575); gains SkillManifest, SkillDomain, SprintCardEnrichment types (commit 079a6e2)
- `ipc.types.ts` — repos:list-updated + sprint-intake-completed push event type signatures added (commits a3054a5, c6497aa); BrainQueryResult, BrainTimelineEntry, RegisterBrainEntryInput types added (commit 4cde8fd)
- `mcp-server.types.ts` — shared MCP server types: SprintCard, risk engine types; JSDoc on interface fields documents S3 handler contract (commits 0a4deb6, a3038ce); gains DispatchSprintToolInput/Output (commit f8089b9); gains CreateProjectMcpInput/Output (commit 7777717); gains ReportFilesChangedToolInput/Output; McpIpcRequest union adds dispatch_sprint, create_project, report_files_changed variants (commit 336bf5b)
- `skill-domains.ts` (constants) — SkillDomain string constants; 'legal' domain added (commits 079a6e2, c7b80be)
- `task.types.ts` — gains target_files_json, skills_json, guardrail_json, risk_factors_json, estimated_tokens, recommended_model, risk_score, created_by fields (commits d36ce78, 079a6e2)
- `telegram.types.ts` — gains socket bridge health status fields (commit 400b329)
