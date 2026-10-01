# Anamnesis Shared Brain — Automatic Writer

AgentHub automatically syncs your Kanban task events and project status to Anamnesis, keeping your shared brain up-to-date in real time. You don't need to do anything — it happens by default.

## What Gets Synced

Every time a task moves through your Kanban board, AgentHub writes an event to Anamnesis:

| Event | Anamnesis Memory Layer | What It Records |
|-------|------------------------|-----------------|
| Task transitions (backlog → today → in progress) | Episodic | Task started, priority, sprint context |
| Task completed | Procedural | Completion time, domain, summary |
| Task interrupted | Procedural | Interruption reason and timestamp |
| Orchestrator task started | Episodic | Agent spawned, model selection, timing |
| Orchestrator task reviewed | Procedural | Review findings, model used |
| Orchestrator task secured (security scan) | Procedural | Security scan results |
| Orchestrator task committed | Procedural | Commit message, files changed |
| Sprint completed | Episodic | Sprint summary, task count, duration |
| Date trigger fired | Episodic | Scheduled task auto-dispatched |
| Brain entry published | Episodic | Knowledge artifact recorded |

## Domain Category Mapping

AgentHub maps your task categories to one of seven shared domains used across the ecosystem:

| AgentHub Category | Anamnesis Domain |
|-------------------|-----------------|
| backend | code |
| frontend | code |
| database | code |
| schema | code |
| functionality | code |
| marketing | marketing |
| business | business |
| research | research *(falls back to code)* |
| content | content *(falls back to code)* |
| legal | legal *(if explicitly set)* |
| strategy | strategy *(if explicitly set)* |
| operations | operations *(if explicitly set)* |

When you set a task category in Kanban (e.g., "backend"), it's automatically translated and sent to Anamnesis under the corresponding domain (e.g., "code"). If a category doesn't map directly, it defaults to **code**.

## Project Status Updates

When a task is completed, AgentHub updates the project status in Anamnesis:

- **Status** is set to `done`
- **Domain** is the task's mapped domain category (e.g., "code", "business", "marketing")
- **Summary** is the task title

This is a best-effort update — if Anamnesis is unreachable, the update is queued and retried automatically. No notification is shown unless there's a persistent connection issue.

## Viewing Your Data in Anamnesis

All synced events appear in your Anamnesis dashboard under the corresponding memory layer:

1. Go to **Anamnesis** (typically `http://localhost:9300` in your local environment)
2. Navigate to **Memory** or **Episodic** to see task events
3. Filter by domain to focus on specific areas (code, business, marketing, etc.)
4. View project status updates under **Projects** → your repo name

## Connectivity & Circuit Breaker

AgentHub includes automatic reliability safeguards:

- **Circuit Breaker**: If Anamnesis is unreachable or unresponsive, AgentHub stops attempting writes after 3 consecutive failures, then automatically retries after 60 seconds
- **Batching**: Events are written in batches of 10 to avoid overwhelming the connection
- **Timeout**: Each write attempt waits 5 seconds; if Anamnesis doesn't respond, the batch is queued for retry
- **Logging**: All sync activity is logged to AgentHub's console and `~/Library/Logs/agenthub/main.log`

If you see a persistent error, check:
1. Anamnesis is running (in your local environment or cloud)
2. The `anamnesisUrl` setting in AgentHub is correct
3. Your `AUTH_SECRET` is set in Anamnesis (if required)

## Brain Entries — What Reaches Anamnesis, and When

- **New documents publish automatically.** Each time the Brain panel refreshes, AgentHub scans your repos and sends the documents it finds for the first time to Anamnesis — oldest first, up to **50 per refresh**.
- **If more than 50 are new,** the rest stay waiting. They go out on the next refresh, or you can send them with the `backfill_brain_entries` tool.
- **Older documents are never re-sent by a refresh.** Anything that was already in the Brain before the refresh (synced or not) is left alone. To send an older, unsynced backlog, run `backfill_brain_entries` — it does a dry run first and needs your confirmation before sending.
- **Registering a document by hand** sends just that one document right away.
- **If sending fails,** the document keeps its unsynced status and the refresh still finishes normally.

## Privacy & Data Control

The shared brain is local by default — your task events stay on your machine until explicitly synced to Anamnesis. You can:

- **Disable sync**: Set `anamnesisUrl: ""` in Settings (AgentHub → Settings → Anamnesis URL)
- **Use a cloud instance**: Point to a remote Anamnesis server instead
- **Review before sending**: Open the AgentHub main log to see what's being written

## No Configuration Needed

Setup is automatic. AgentHub discovers your Anamnesis instance via the `anamnesisUrl` setting and begins syncing immediately. If you don't have Anamnesis running, events queue locally and sync when it comes back online.
