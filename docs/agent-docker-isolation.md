# Agent Isolation — Docker Hybrid B+C Implementation Plan

> **Model**: One container per repo, shared by team session. Agents within a team share the same container filesystem.
> **Date**: 2026-03-12
> **Status**: Planning (no implementation)
> **Docker Runtime**: Docker Desktop (macOS)

---

## Resolved Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | **Spawn agent container lifecycle** | Destroy when all agents in the session stop |
| 2 | **Repo container lifecycle** | Stop on app quit. Auto-destroy after 7 days idle (TTL-based, configurable). On next app start: if container age < TTL → restart; if > TTL → destroy & recreate |
| 3 | **Claude CLI in container** | Bundle in Docker image. Provide `npm run docker:rebuild` script. Version check on app start prompts rebuild if outdated |
| 4 | **Git inside containers** | Spawn agents: NO git access. Lead agent in repo container: YES — mount `.gitconfig` + SSH keys (read-only) |
| 5 | **Docker runtime** | Docker Desktop |
| 6 | **Network** | Host network by default (required for Anthropic API). `--network=none` available as strict-isolation toggle |

---

## Architecture Overview

```
Electron Main Process (macOS native)
  ├── AgentManager (existing)
  │     └── spawns PTY → claude CLI (current: native)
  ├── DockerService (NEW)
  │     ├── detects Docker Desktop availability
  │     ├── builds/rebuilds agent image
  │     └── CLI version check + rebuild prompt
  ├── ContainerManager (NEW)
  │     ├── creates one container per repo
  │     ├── manages lifecycle: create → start → stop → destroy
  │     ├── TTL-based auto-cleanup (default 7 days)
  │     ├── tracks container-to-repo mapping in DB
  │     └── orphan detection on app start
  └── DockerAgentAdapter (NEW)
        ├── executes `docker exec -it <container> claude ...`
        ├── bridges PTY ↔ container stdin/stdout
        ├── mounts repo as /workspace (read-write)
        ├── mounts ~/.claude as /home/agent/.claude (read-only)
        ├── lead agent: mounts .gitconfig + SSH keys (read-only)
        └── injects ANTHROPIC_API_KEY as env var
```

### Container Lifecycle Flow

```
App Start
  └── ContainerManager.init()
        ├── detect orphaned containers → prompt user to clean
        ├── check TTL on stopped containers
        │     ├── age < 7 days → leave stopped (restart on demand)
        │     └── age >= 7 days → destroy
        └── check Claude CLI version in image → prompt rebuild if outdated

Agent Spawn (autonomous mode ON)
  └── AgentManager.spawn()
        ├── ContainerManager.ensureContainer(repoId, repoPath)
        │     ├── container exists + running → reuse
        │     ├── container exists + stopped → restart
        │     └── no container → create + start
        └── DockerAgentAdapter.exec(containerId, claudeCmd)
              └── `docker exec -it <container> claude --dangerously-skip-permissions ...`

Agent Stop
  └── DockerAgentAdapter.kill(agentPid)
        └── `docker exec <container> kill -SIGINT <pid>`

All Agents Stopped (session end)
  └── ContainerManager.onSessionEnd(repoId)
        └── stop container (preserve for restart within TTL)

App Quit
  └── ContainerManager.stopAll()
        └── stop all running containers, record lastActivity timestamp
```

---

## Phase 1: Foundation (Sprint 1-2)

> Goal: Docker image + ContainerManager service that can start/stop containers

### Sprint 1 — Docker Image & Detection

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S1.1 | **Dockerfile for Claude CLI agent** — Minimal Dockerfile: `node:20-slim` base, install Claude CLI via npm globally, create non-root `agent` user with configurable UID (default 501 for macOS). Store in `docker/agent/Dockerfile`. Include `.dockerignore`. | Image builds in < 2min. `docker run agenthub-cli claude --version` succeeds. Image < 500MB. |
| S1.2 | **Docker availability detection** — `DockerService` in `src/main/services/docker-service.ts`. Methods: `isAvailable()` (runs `docker info`), `getVersion()`, `isImageBuilt()`. Expose via IPC: `docker:status`. Cache result for 30s. | Renderer can query `window.agentHub.docker.status()`. Returns `{ available: boolean, version?: string, imageReady: boolean }` |
| S1.3 | **Image build management** — `DockerService.buildImage()` runs `docker build` with progress streaming via IPC events (`docker:build-progress`). `DockerService.ensureImage()` = check + build if missing. Add `npm run docker:build` and `npm run docker:rebuild` scripts to `package.json`. | Image auto-builds on first use. Progress events emitted. Rebuild script works. |
| S1.4 | **Docker types & schemas** — `src/shared/types/docker.types.ts`: `ContainerState`, `ContainerInfo`, `DockerStatus`, `DockerConfig`. `src/shared/schemas/docker.schemas.ts`: matching Zod schemas. IPC channels in `ipc-channels.ts`. | Types compile. Schemas validate. IPC channels registered. |

### Sprint 2 — ContainerManager Lifecycle

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S2.1 | **ContainerManager service** — `src/main/services/container-manager.ts`. Core methods: `ensureContainer(repoId, repoPath, options)`, `stopContainer(repoId)`, `destroyContainer(repoId)`, `stopAll()`. Internal Map tracks `repoId → { containerId, status, lastActivity }`. | Programmatic create/start/stop/destroy works. Map stays in sync. |
| S2.2 | **Volume mounting** — `ensureContainer` configures mounts: repo path → `/workspace` (rw), `~/.claude` → `/home/agent/.claude` (ro). For lead agent role: `.gitconfig` → `/home/agent/.gitconfig` (ro), `~/.ssh` → `/home/agent/.ssh` (ro). Env: `ANTHROPIC_API_KEY` from `process.env`. | Files created by agent inside container appear on host filesystem with correct ownership. API key accessible inside container. |
| S2.3 | **DB tracking + TTL** — Migration 006: `containers` table (`id`, `repo_id`, `container_id`, `status`, `created_at`, `last_activity`, `config_json`). On app start, ContainerManager checks `last_activity` against TTL setting (default 7 days). Expired → destroy. | DB tracks containers. Expired containers auto-destroyed on app start. |
| S2.4 | **App lifecycle hooks** — Wire `ContainerManager.stopAll()` to Electron `before-quit`. Wire `ContainerManager.init()` to app startup (in service-orchestrator). Orphan detection: list `agenthub-*` containers, reconcile with DB, prompt user for unknowns. | Containers stop on quit. Orphans detected and surfaced. |
| S2.5 | **ServiceOrchestrator wiring** — Register `DockerService` and `ContainerManager` in `service-orchestrator.ts`. Init order: DockerService (checks availability) → ContainerManager (depends on DockerService). | Both services initialize correctly. Graceful skip if Docker unavailable. |

---

## Phase 2: Agent Integration (Sprint 3-4)

> Goal: Wire ContainerManager into AgentManager so agents spawn inside containers

### Sprint 3 — Docker Agent Adapter

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S3.1 | **DockerAgentAdapter** — `src/main/services/adapters/docker-agent-adapter.ts`. Method: `exec(containerId, command, options) → { write, onData, kill, resize }`. Uses `node-pty` to spawn `docker exec -it <container> <command>`. Returns PTY-compatible interface matching what AgentManager expects. | Adapter produces read/write streams. Data flows bidirectionally. |
| S3.2 | **AgentManager routing** — In `AgentManager.spawn()`: if `skipPermissions === true` AND `DockerService.isAvailable()` AND image ready → route through `DockerAgentAdapter`. Otherwise → native PTY (existing path). Add `executionMode: 'native' \| 'docker'` to AgentState for tracking. | Autonomous agents use Docker. Non-autonomous use native. Fallback works. |
| S3.3 | **PTY bridge compatibility** — Ensure `docker exec -it` PTY output is compatible with existing: terminal rendering in xterm.js, IPC batching (16ms renderer / 2s DB), breakout window forwarding via Unix socket at `/tmp/agenthub/pty-{id}.sock`. Test resize (SIGWINCH) propagation. | Terminal renders identically. Breakout windows work. Resize works. |
| S3.4 | **Container-aware kill** — Adapt kill hierarchy for Docker agents: get PID inside container via `docker exec <container> pgrep -f claude`, then `docker exec <container> kill -SIGINT <pid>`, escalate to SIGTERM/SIGKILL. Final fallback: `docker stop <container> -t 5`. | Agent stops reliably. No zombie processes inside container. |

### Sprint 4 — Multi-Agent & Permissions

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S4.1 | **Shared container session** — Multiple `docker exec` processes inside one container. ContainerManager tracks exec count per container. Container stays running as long as exec count > 0. | 3 agents on repo X all run in same container. Each has independent PTY. |
| S4.2 | **Lead vs spawn agent permissions** — DockerAgentAdapter accepts `role: 'lead' \| 'spawn'`. Lead gets git mounts (`.gitconfig`, `.ssh`). Spawn agents get no git mounts. Both get `--dangerously-skip-permissions`. | Lead can run git commands. Spawn agents cannot. |
| S4.3 | **Resource limits** — `docker create` with `--cpus=2 --memory=4g` (configurable via DockerConfig). Limits apply per container (shared by all agents in that repo). | Container respects limits. Configurable in settings. |
| S4.4 | **Network config** — Default: `--network=host` (needed for Anthropic API calls). Setting to switch to `--network=none` for strict isolation (only works with local models). | API calls work by default. Strict mode available. |

---

## Phase 3: UX & Reliability (Sprint 5-6)

> Goal: Polish the experience, handle edge cases, test thoroughly

### Sprint 5 — UI & Settings

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S5.1 | **Docker settings panel** — New section in SettingsPanel: Docker enable/disable toggle, resource limits (CPU cores slider, RAM slider), TTL days input, image version display + rebuild button. Persist via SettingsService. | Settings persist in DB. Applied on next container creation. |
| S5.2 | **Container lifecycle controls** — In agent detail panel (General tab): show execution mode badge ("Native" / "Docker"). In repo context menu or container section: "Stop Container", "Restart Container", "Destroy Container" actions. | User can manually manage containers. |
| S5.3 | **Docker status indicator** — Small indicator in app header: Docker icon, green/red/gray for available/unavailable/unchecked. Tooltip shows version + active container count. Click opens Docker settings. | Always visible. Updates on status change. |
| S5.4 | **Spawn dialog Docker feedback** — When autonomous mode toggled ON: if Docker available + image ready → show "Runs in isolated Docker container" (green). If Docker unavailable → show "Docker not available — runs natively with skip-permissions" (yellow warning). If image not built → show "Building Docker image..." with progress. | Clear, contextual feedback. No surprise behavior. |
| S5.5 | **CLI version check UX** — On app start, compare Claude CLI version in image vs installed on host. If mismatch → notification: "Claude CLI updated. Rebuild Docker image?" with action button. | User prompted to rebuild. One-click rebuild. |

### Sprint 6 — Testing & Edge Cases

| Story | Description | Acceptance Criteria |
|-------|-------------|---------------------|
| S6.1 | **Integration tests — DockerService** — Real Docker: `isAvailable()`, `buildImage()`, `ensureImage()`. Cleanup built images in afterAll. | Docker detection and image management tested end-to-end |
| S6.2 | **Integration tests — ContainerManager** — Real Docker: create, start, stop, destroy, TTL expiry, orphan detection. Cleanup containers in afterEach. | Full lifecycle tested. No leaked containers. |
| S6.3 | **Integration tests — DockerAgentAdapter** — Spawn a process inside container via adapter, verify stdin/stdout flow, verify file writes to mounted volume appear on host. | PTY bridge works end-to-end. |
| S6.4 | **Integration tests — multi-agent sharing** — Spawn 3 exec processes in one container. Kill them sequentially. Verify container stays up until last one exits. | Shared container lifecycle correct. |
| S6.5 | **Fallback behavior tests** — Mock Docker unavailable (rename binary). Verify AgentManager falls back to native PTY. Verify UI shows correct status. | Graceful degradation confirmed. |
| S6.6 | **Stale container recovery** — Simulate crash (don't call stopAll). Restart app. Verify orphans detected and user prompted. | No resource leaks from crashes. |

---

## File Map (new files)

```
docker/
  agent/
    Dockerfile
    .dockerignore
src/shared/
  types/docker.types.ts
  schemas/docker.schemas.ts
  constants/ipc-channels.ts          (update: add docker channels)
src/main/
  services/docker-service.ts
  services/container-manager.ts
  services/adapters/docker-agent-adapter.ts
  services/service-orchestrator.ts    (update: register new services)
  services/agent-manager.ts           (update: routing logic)
  db/migrations/006-containers.ts
src/renderer/
  src/widgets/spawn-dialog/SpawnDialog.tsx  (update: Docker feedback)
  src/widgets/settings/SettingsPanel.tsx    (update: Docker section)
  src/App.tsx                               (update: Docker status)
```

---

## Dependencies

- Docker Desktop for macOS (user-installed prerequisite)
- `node:20-slim` base image (pulled from Docker Hub)
- Claude CLI npm package (installed in image at build time)
- Existing: `node-pty`, `agent-manager.ts`, `service-orchestrator.ts`, IPC channels, breakout windows, SettingsService

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker Desktop not installed | Feature unavailable | Graceful fallback to native + setup guide link in UI |
| PTY bridging latency via `docker exec` | Sluggish terminal | Benchmark; `docker exec -it` uses direct TTY attachment, minimal overhead |
| Container startup time (~2-5s) | Perceived slowness on first agent | Pre-warm: start container when user selects repo in spawn dialog |
| Volume mount permission issues (UID mismatch) | Agent can't write files | Dockerfile creates user with macOS default UID 501; configurable via build arg |
| Image size (~400-500MB) | Slow first build | Multi-stage build; `node:20-slim` base; cache layers aggressively |
| Docker Desktop resource usage | High memory/CPU on host | Configurable resource limits per container; document recommended Docker Desktop settings |
| Stale containers consuming resources | Wasted resources | TTL auto-destroy (7 days default) + orphan detection on app start |
| Claude CLI update breaks image | Agent can't start | Version check on app start + one-click rebuild |
