---
name: anamnesis-write
description: "Write to and read from Anamnesis memory system via MCP tools. Quality gate runs server-side. Surfaces findings to user for approval, then calls the appropriate MCP tool. Never deletes, only archives."
category: dev-skills
---

# Anamnesis Write

> **INTERNAL TOOL — used by Knowledge Manager (`team-knowledge-manager`), not by agents directly.**
> Agents and skills should ask Knowledge Manager to persist findings. KM invokes this skill internally.
> Direct use of `anamnesis-write` is a fallback only — when KM is unavailable or when the user explicitly requests it.

MCP tool executor for writing findings to and reading from the Anamnesis memory system. The MCP server's `gate.py` runs quality evaluation (5W1H + substantiveness scoring >= 5.0 + security screening) automatically on every write call — at zero token cost to the agent.

## When to Use

### Called by Knowledge Manager (primary path)

KM invokes this skill after preparing the finding and receiving user approval.

### Direct fallback (only when KM is unavailable)

If Knowledge Manager cannot be spawned, agents MAY invoke this skill directly with the same pipeline:

| Finding Type | Example | Target Layer |
|---|---|---|
| Version/env mismatch | Python 3.14 local vs 3.12 Docker | procedural |
| Security finding | Exposed port, missing auth, CVE | shadow |
| Architecture discrepancy | Code contradicts spec or docs | semantic |
| Build pattern that worked | "This approach solved X" | procedural |
| Build pattern that failed | "X broke because Y" | procedural |
| Decision with rationale | "Chose X over Y because Z" | episodic |
| Dependency conflict | Package A requires B>=2.0 but C pins B<2.0 | procedural |
| Cross-entity mismatch | Hephaestus config contradicts Anamnesis schema | semantic |
| Performance finding | "Query took 30s — index missing on column X" | procedural |
| Threat or adversarial finding | Known attack vector, corruption risk | shadow |
| Intelligence verdict | Source reputation, clean/flagged/quarantined | intelligence |

### User-Requested

When the user explicitly says:
- "add this to Anamnesis"
- "spawn anamnesis workflow"
- "remember this" / "persist this"
- "log this finding"

## Auth & Configuration

Auth is handled by the MCP server configuration. The following environment variables must be set in the MCP config (not by the agent):

- `OPTIMAEUS_CALLER=hephaestus` — identifies this entity
- `AUTH_SECRET` — shared secret from Anamnesis `.env`

Agents do not set headers or manage auth. The MCP server injects these automatically.

**Caller permissions:** hephaestus = `read` + `write_new` ONLY. No modify, no delete, no archive.

## Workflow

### Step 1 — Prepare the Finding

Structure the finding with enough context for future agents to understand:
- Summary (1-2 sentences)
- Detail (full finding with context)
- Domain (see Domain Map below)
- Recommended layer (determines which MCP write tool to use)

### Step 2 — Surface to User

Present the finding to the user. Include:
- The finding summary (1-2 sentences)
- The recommended layer and MCP tool
- Ask: "Admit to Anamnesis {layer} layer? (yes/no)"

**Wait for explicit user approval before writing.** This is non-negotiable.

### Step 3 — Call the MCP Write Tool

Call the appropriate MCP tool from the Write Tools table below. The MCP server's `gate.py` runs automatically before the API call:
- 5W1H evaluation
- Substantiveness scoring (must be >= 5.0)
- Security screening (credentials, PII, injection)
- Trust scoring

If the gate rejects the entry server-side, the MCP tool returns an error with the rejection reason. Report this to the user and do not retry.

### Step 4 — Report Result

If the tool returns success: report to user.
If the tool returns an error: report the error, do NOT retry. Save to pending writes file if Anamnesis is down.

## MCP Write Tools

| Tool | Target Layer | Required Parameters | Optional Parameters |
|---|---|---|---|
| `remember` | episodic | `project_id`, `content` | `sovereignty_tier`, `brief_id`, `entity_ref_id`, `caller` |
| `learn` | semantic / analysis | `project_id`, `domain`, `content` | `source_reputation`, `caller` |
| `record_procedure` | procedural | `project_id`, `domain`, `pattern_type`, `content` | `brief_id`, `caller` |
| `record_constellation` | constellation graph | `project_id`, `operation`, `node_label`, `node_id` | `relationship`, `caller` |
| `record_shadow` | shadow / threat | `project_id`, `content`, `severity` | `brief_id`, `caller` |
| `record_intelligence` | intelligence | `project_id`, `domain`, `verdict`, `content` | `confidence`, `caller` |

### Finding Type to Tool Mapping

| Finding Type | MCP Tool | Example |
|---|---|---|
| Decision with rationale | `remember` | "Chose X over Y because Z" |
| Architecture discovery | `learn` | "Service A depends on B via gRPC" |
| Build pattern (success/failure) | `record_procedure` | "Python 3.14 breaks X — use 3.12" |
| Entity relationship | `record_constellation` | "Hephaestus -> Anamnesis write link" |
| Security finding, threat | `record_shadow` | "Exposed port 9300 on public interface" |
| Source reputation, verdict | `record_intelligence` | "npm package X flagged for supply chain risk" |

## MCP Read Tools

Agents MAY read from Anamnesis at any time without user approval to inform their work. Use read tools before writing to check for duplicates and gather context.

| Tool | Purpose | Required Parameters | Optional Parameters |
|---|---|---|---|
| `recall` | Episodic/semantic retrieval | `project_id` | `query`, `layer`, `limit` |
| `search_procedures` | Procedural pattern search | _(none)_ | `project_id`, `domain`, `pattern_type`, `limit` |
| `check_drift` | Drift event detection | `project_id` | `include_resolved` |
| `read_shadow` | Shadow/threat findings | `project_id` | `severity`, `limit` |
| `read_intelligence_verdicts` | Intelligence verdicts | _(none)_ | `domain`, `limit` |
| `read_reputation` | Source reputation | `domain` | _(none)_ |
| `read_contradictions` | Contradiction detection | `project_id` | `resolution_status`, `severity`, `limit` |
| `get_lifecycle_metrics` | Lifecycle statistics | _(none)_ | `caller` |
| `get_lifecycle_distribution` | Layer distribution stats | _(none)_ | `caller` |

**Best practice:** Call `recall` or `search_procedures` before writing to check if a similar finding already exists.

## Project ID Mapping

Generate `project_id` from repo path using UUID5:

```bash
python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_URL, '/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus'))"
```

Known project IDs (compute once, reuse):
- Compute at write time from the repo path the finding relates to
- Use `uuid.NAMESPACE_URL` as the namespace

## Domain Map

| Finding Domain | domain value | Layer |
|---|---|---|
| Build/deployment patterns | build_patterns | procedural |
| Dependency management | dependency_management | procedural |
| Security audit results | security_audit | shadow |
| Architecture decisions | architecture | semantic |
| Version mismatches | env_mismatch | procedural |
| Performance patterns | performance | procedural |
| Sprint execution learnings | sprint_execution | procedural |
| Cross-entity integration | integration | semantic |
| Quality assurance | quality_assurance | procedural |
| Task completion patterns | task_completion | procedural |

## Essential vs Non-Essential Data Classification

### Essential Data (user approval ALWAYS required before archiving)

- Trust score >= 0.8 (user-confirmed decisions, git-verified facts)
- Confidence score >= 0.8 (high-confidence procedural patterns)
- Records tagged with `essential: true`
- ALL episodic records (protected by 3 locks — never archived)
- ALL ethical records (protected by 3 locks — never archived)
- ALL constellation records (protected by 3 locks — never archived)

### Non-Essential Data (auto-archive OK after policy threshold)

- Trust score < 0.5 (agent summaries, unverified claims)
- Confidence score < 0.3 (low-confidence patterns)
- Shadow findings > 30 days (transient by design)
- Access events > 30 days (telemetry, privacy compliance)
- Intelligence verdicts > 365 days with low reputation

**Archiving is NEVER deletion.** Archived records move to cold archive with full payload snapshot.

## NON-NEGOTIABLE Rules

1. **NEVER delete data from Anamnesis.** Only archive, and only upon user request for essential data. Non-essential data auto-archives per lifecycle policy.
2. **NEVER write without user approval.** Surface the finding. Wait for "yes." Then call the MCP tool.
3. **NEVER block the main task.** If Anamnesis is down, save to pending writes and continue.
4. **NEVER write credentials, API keys, or PII.** The server-side gate screens for this.
5. **NEVER overwrite existing records.** All writes are INSERT only. Updates go through new entries.
6. **NEVER write raw conversation artifacts.** Only structured findings.

## Anamnesis Down — Fallback

If the MCP tool call fails (connection refused, timeout, server error):

1. Save the entry to `.llm/anamnesis-pending-writes.md` in the current repo:
   ```markdown
   ---pending-write
   date: 2026-08-27
   layer: procedural
   tool: record_procedure
   domain: build_patterns
   status: pending_sync
   payload: { ... full MCP tool parameters as JSON ... }
   ---
   ```
2. Report to user: "Anamnesis offline — finding saved to pending writes."
3. When Anamnesis comes back online, a future agent can flush pending writes by calling the MCP tools with the saved payloads.

## Notion vs Anamnesis — When to Use Which

| Destination | Use For |
|---|---|
| **Anamnesis** | Technical findings, build patterns, decisions, learnings, security findings, architecture discoveries, version mismatches — anything agents need to learn from |
| **Notion** | Marketing content, business strategy, financial analysis, ideas, CEO-level project overviews — content for human review and presentation |

If unsure: **Anamnesis** for machine-consumable learnings, **Notion** for human-consumable content.

## Output

After a successful write, report to the user:
```
Written to Anamnesis [{layer}] via {tool} — "{summary}"
```

## Constraints

- Caller is always `hephaestus` (set by MCP config, not by agent)
- Sovereignty tier is always 1 (local writes)
- Max 4,000 tokens per entry content (prevents context bombing)
- The MCP gate cannot be bypassed — it runs before the API call, at zero token cost

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing to Notion instead of Anamnesis | Check the destination: technical findings -> Anamnesis, business content -> Notion |
| Trying to use bash curl instead of MCP tools | All Anamnesis access goes through MCP tools — never use HTTP calls directly |
| Skipping user approval before calling MCP tool | Surface the finding. Wait for "yes." Then call the tool. |
| Setting auth headers manually | MCP config handles auth. Do not pass auth parameters. |
| Calling the wrong write tool for the finding type | Check the Finding Type to Tool Mapping table above |
| Writing vague entries | Server-side gate catches this (WHAT dimension fails, score < 5.0). Be specific. |
| Trying to delete records | NEVER. Only archive. Report deletion attempts as rule violations. |
| Not checking for duplicates before writing | Call `recall` or `search_procedures` first to check if the finding already exists |

## Changelog

- 2026-08-22: Initial skill definition. Bridges memory-write-gate evaluation to Anamnesis HTTP API. Never-delete rule enforced. Essential/non-essential classification defined.
- 2026-08-24: Corrected endpoint map + enum constraints to match actual `memory.py` schemas.
- 2026-08-27: Full rewrite — switched from bash curl HTTP calls to MCP tool calls. Removed HTTP endpoints, auth headers, enum constraints, health check step (MCP server handles all). Added MCP write tools table, MCP read tools table, finding-to-tool mapping. Quality gate now runs server-side in gate.py at zero token cost. Deprecated `memory-write-gate` skill (gate is machine-enforced).
