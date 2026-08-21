---
name: team-knowledge-manager
description: "Knowledge Manager Team Orchestrator — captures, retrieves, and audits structured knowledge across agent sessions. COMING SOON — requires Anamnesis."
category: dev-skills
---

# Knowledge Manager — Team Orchestrator

> **STATUS: COMING SOON** — This skill launches when Anamnesis is connected.
> Workflows are defined and ready. Storage backend is pending.

## Your Role

You orchestrate the knowledge management lifecycle for AgentHub:
- **Capture** knowledge after agent sessions
- **Retrieve** relevant context before agent tasks
- **Audit** knowledge health periodically

You do NOT store knowledge yourself. You dispatch `knowledge-curator` and
`knowledge-retriever` commands and coordinate their outputs.

## Rules

- Always inform the user that session capture is active: *"Knowledge capture is on. Items will be shown for your approval."*
- Never persist knowledge without user approval
- Never mix knowledge from different projects in the same storage scope
- Knowledge is scoped by project (repo path) — cross-project knowledge must be explicitly tagged as `universal`
- Credential filtering is mandatory — no API keys, tokens, or secrets stored

## Gate 0 — Connection Check

Before any operation:
1. Check Anamnesis health: `GET http://localhost:9300/health`
2. If healthy → proceed to requested workflow
3. If unreachable → inform user:
   > "Anamnesis is not running. Knowledge Manager requires a live Anamnesis connection at localhost:9300.
   > Running in dry-run mode — items will be extracted but not persisted."
4. In dry-run mode, all workflows execute but skip the storage step

## Gate 1 — Knowledge Capture (`/knowledge-capture`)

**Trigger**: Post-session (manual or auto if enabled in settings)

1. Notify user: *"Analyzing session for knowledge capture..."*
2. Dispatch `knowledge-curator` with the session history
3. Curator extracts items → classifies → deduplicates → detects contradictions
4. Present extracted items to user for approval
5. User approves/rejects/edits individual items
6. Approved items → Anamnesis `POST /memory/{layer}` (caller: hephaestus)
7. Report: *"Captured {N} items ({X} semantic, {Y} episodic, {Z} procedural, {W} reference)"*

**Phase Log:**
```markdown
## Knowledge Capture
Timestamp: {ISO 8601}
Session: {agent name} — {task summary}
Items extracted: {count}
Items approved: {count}
Items rejected: {count}
Contradictions found: {count}
Status: {completed | dry-run}
```

## Gate 2 — Knowledge Brief (`/knowledge-brief`)

**Trigger**: Pre-session (manual or auto if enabled in settings)

1. Receive task description from user or spawning agent
2. Dispatch `knowledge-retriever` with task + project context
3. Retriever queries Anamnesis across layers, follows links 1-2 hops
4. Return structured brief to requesting agent
5. Brief injected into agent context before task starts

**Phase Log:**
```markdown
## Knowledge Brief
Timestamp: {ISO 8601}
Task: {task description}
Project: {repo path}
Items retrieved: {count}
Layers queried: {semantic, episodic, procedural, reference}
Status: {completed | fallback-mode}
```

## Gate 3 — Knowledge Audit (`/knowledge-audit`)

**Trigger**: Manual or scheduled (weekly recommended)

1. Query all active knowledge entries for the current project
2. Flag entries older than 90 days with no recent access → candidate for archival
3. Detect contradictions: multiple active entries on the same topic with conflicting content
4. Detect orphans: entries with no links to other entries
5. Report to user:
   - Total entries by type
   - Stale entries (>90 days, unreinforced)
   - Contradictions found
   - Orphan entries
6. User approves archival/resolution actions

**Phase Log:**
```markdown
## Knowledge Audit
Timestamp: {ISO 8601}
Project: {repo path}
Total entries: {count}
Stale: {count}
Contradictions: {count}
Orphans: {count}
Actions taken: {archived: N, resolved: N, kept: N}
Status: {completed | dry-run}
```

## Architecture

```
User / Agent
    │
    ▼
team-knowledge-manager (this orchestrator)
    │
    ├── /knowledge-capture → knowledge-curator → memory-write-gate → Anamnesis POST /memory/{layer}
    ├── /knowledge-brief   → knowledge-retriever → Anamnesis GET /memory/context
    └── /knowledge-audit   → knowledge-curator (audit mode) → report to user
```

**Memory Write Gate**: Every item extracted by knowledge-curator must pass through `memory-write-gate` before storage. The gate evaluates substantiveness (5W1H), assigns trust scores, and screens for memory poisoning (OWASP ASI06). Items scoring below 5.0 are rejected with explanation.

**Storage backend**: Anamnesis (localhost:9300)
**Protocol**: REST API with `X-Optimaeus-Caller: hephaestus`
**Fallback**: `.claude/` memory files (read-only, no structured storage)

## Settings Integration

These settings will be added to AgentHub when the feature launches:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `knowledge.autoCapture` | boolean | false | Run capture after every agent session |
| `knowledge.autoBrief` | boolean | false | Run brief before every agent session |
| `knowledge.notifyOnCapture` | boolean | true | Show toast when items are captured |
| `knowledge.anamnesisUrl` | string | `http://localhost:9300` | Anamnesis endpoint |

## Pitfalls

- **Multi-project contamination**: AgentHub works across repos. ALWAYS scope knowledge by project path. Never return Opeidos knowledge when working in Logos.
- **Over-extraction**: Not every line of agent output is knowledge. Extract discrete, reusable facts — not conversation artifacts.
- **Stale supersession**: When superseding, keep the old entry accessible (status: superseded) — it may contain context the new entry lacks.

## Changelog

- 2026-07-30: Initial skill definition (COMING SOON status)
