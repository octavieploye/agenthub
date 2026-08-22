---
name: anamnesis-write
description: "Write data to Anamnesis memory system — Knowledge Manager's internal executor. Evaluates entries via memory-write-gate, surfaces findings to user, then POSTs to the Anamnesis API on approval. Never deletes, only archives."
category: dev-skills
---

# Anamnesis Write

> **INTERNAL TOOL — used by Knowledge Manager (`team-knowledge-manager`), not by agents directly.**
> Agents and skills should ask Knowledge Manager to persist findings. KM invokes this skill internally.
> Direct use of `anamnesis-write` is a fallback only — when KM is unavailable or when the user explicitly requests it.

HTTP POST executor for writing findings to the Anamnesis memory system. Called after `memory-write-gate` evaluates and admits an entry.

## When to Use

### Called by Knowledge Manager (primary path)

KM invokes this skill after running `memory-write-gate` and receiving user approval.

### Direct fallback (only when KM is unavailable)

If Knowledge Manager cannot be spawned, agents MAY invoke this skill directly with the same pipeline:

| Finding Type | Example | Target Layer |
|---|---|---|
| Version/env mismatch | Python 3.14 local vs 3.12 Docker | procedural |
| Security finding | Exposed port, missing auth, CVE | ethical |
| Architecture discrepancy | Code contradicts spec or docs | semantic |
| Build pattern that worked | "This approach solved X" | procedural |
| Build pattern that failed | "X broke because Y" | procedural |
| Decision with rationale | "Chose X over Y because Z" | episodic |
| Dependency conflict | Package A requires B>=2.0 but C pins B<2.0 | procedural |
| Cross-entity mismatch | Hephaestus config contradicts Anamnesis schema | semantic |
| Performance finding | "Query took 30s — index missing on column X" | procedural |

### User-Requested

When the user explicitly says:
- "add this to Anamnesis"
- "spawn anamnesis workflow"
- "remember this" / "persist this"
- "log this finding"

## What You Need Before Starting

1. **Anamnesis must be running** — verify with `curl http://localhost:9300/health`
2. **Auth credentials** — `AUTH_SECRET` from env or from `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis/build/backend/.env`
3. **The finding** — what you want to write, with enough context for future agents to understand

## Workflow

### Step 1 — Evaluate (memory-write-gate)

Run the `memory-write-gate` evaluation on the candidate entry. This produces:
- 5W1H assessment (What/Why/When/Where/How)
- Substantiveness score (must be >= 5.0 to proceed)
- Trust score (0.0-1.0)
- Security screening (credentials, PII, injection)
- Target layer recommendation (episodic/semantic/procedural/ethical)

If the gate returns **REJECT**, stop. Log the rejection reason and move on.
If the gate returns **REWRITE NEEDED**, adjust the entry and re-evaluate.

### Step 2 — Surface to User

Present the gate evaluation to the user. Include:
- The finding summary (1-2 sentences)
- The recommended layer
- The substantiveness score
- Ask: "Admit to Anamnesis {layer} layer? (yes/no)"

**Wait for explicit user approval before writing.** This is non-negotiable.

### Step 3 — Check Anamnesis Health

```bash
curl -s http://localhost:9300/health
```

Expected: `{"status":"ok","postgres":true,"memgraph":true,"qdrant":true,"ollama":true,"port":9300}`

If Anamnesis is down:
- Log the finding locally (append to `.llm/anamnesis-pending-writes.md` in the current repo)
- Tell the user: "Anamnesis is offline. Finding saved to pending writes file for later sync."
- Do NOT retry in a loop. Do NOT block the main task.

### Step 4 — Write to Anamnesis

Build the payload and POST to the correct endpoint.

**Auth header** (read AUTH_SECRET from anamnesis .env if not in environment):
```
X-Optimaeus-Caller: hephaestus
Authorization: Bearer {AUTH_SECRET}
Content-Type: application/json
```

**Endpoint map:**

| Layer | Endpoint | Required Fields |
|---|---|---|
| episodic | `POST http://localhost:9300/memory/episodic` | source_entity, project_id, content |
| semantic | `POST http://localhost:9300/memory/semantic` | source_entity, domain, content |
| procedural | `POST http://localhost:9300/memory/procedural` | source_entity, domain, pattern_type, content |
| ethical | `POST http://localhost:9300/memory/ethical` | source_entity, content |

**Payload structure:**

```json
{
  "source_entity": "hephaestus",
  "project_id": "<uuid5 of repo path — see Project ID section>",
  "domain": "<relevant domain — see Domain Map>",
  "content": {
    "summary": "<1-2 sentence human-readable summary>",
    "detail": "<full finding with context>",
    "discovered_by": "<agent name>",
    "discovered_at": "<ISO 8601 timestamp>",
    "trust_score": <0.0-1.0 from gate evaluation>,
    "resolution_status": "open | resolved",
    "resolution_condition": "<when this finding expires or is resolved>"
  },
  "sovereignty_tier": 1
}
```

**Example curl (agent executes this via Bash):**

```bash
curl -s -X POST http://localhost:9300/memory/procedural \
  -H "X-Optimaeus-Caller: hephaestus" \
  -H "Authorization: Bearer $(grep AUTH_SECRET /Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis/build/backend/.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "source_entity": "hephaestus",
    "domain": "build_patterns",
    "pattern_type": "env_mismatch",
    "content": {
      "summary": "Python 3.14 local vs 3.12 Docker target in OPTimaeus",
      "detail": "Local backend venv uses Python 3.14.3 but Dockerfile targets python:3.12-slim. Voice venv realigned to 3.12. Backend mismatch remains.",
      "discovered_by": "voice-pipeline-coordinator",
      "discovered_at": "2026-08-22T09:00:00Z",
      "trust_score": 0.8,
      "resolution_status": "open",
      "resolution_condition": "Backend venv realigned to Python 3.12"
    }
  }'
```

### Step 5 — Confirm

If the API returns 2xx: report success to user.
If the API returns 4xx/5xx: report the error, do NOT retry. Save to pending writes file.

## Project ID Mapping

Generate project_id from repo path using UUID5:

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
| Security audit results | security_audit | ethical |
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

**Archiving is NEVER deletion.** Archived records move to `cold_archive` with full payload snapshot, restorable via `POST /lifecycle/archive/{id}/restore`.

## Reading from Anamnesis (agents can do this freely)

Agents MAY read from Anamnesis at any time without user approval to inform their work:

```bash
# Get assembled context for a project
curl -s -H "X-Optimaeus-Caller: hephaestus" \
  -H "Authorization: Bearer {AUTH_SECRET}" \
  "http://localhost:9300/memory/context?project_id={uuid}&query={search_term}"

# Check before acting (pre-action gate)
curl -s -H "X-Optimaeus-Caller: hephaestus" \
  -H "Authorization: Bearer {AUTH_SECRET}" \
  "http://localhost:9300/memory/check-before-action?query={what_you_plan_to_do}"

# Read procedural patterns for a domain
curl -s -H "X-Optimaeus-Caller: hephaestus" \
  -H "Authorization: Bearer {AUTH_SECRET}" \
  "http://localhost:9300/memory/procedural?domain=build_patterns"
```

Use `check-before-action` before starting work to learn from past patterns and avoid repeating mistakes.

## NON-NEGOTIABLE Rules

1. **NEVER delete data from Anamnesis.** Only archive, and only upon user request for essential data. Non-essential data auto-archives per lifecycle policy.
2. **NEVER bypass the memory-write-gate.** Every write must be evaluated first.
3. **NEVER write without user approval.** Surface the finding, wait for "yes."
4. **NEVER block the main task.** If Anamnesis is down, save to pending writes and continue.
5. **NEVER write credentials, API keys, or PII.** The gate screens for this — respect its verdict.
6. **NEVER overwrite existing records.** All writes are INSERT only. Updates go through new entries.
7. **NEVER write raw conversation artifacts.** Only structured findings that pass the gate.

## Anamnesis Down — Fallback

If Anamnesis is unreachable:

1. Save the gate-evaluated entry to `.llm/anamnesis-pending-writes.md` in the current repo:
   ```markdown
   ---pending-write
   date: 2026-08-22
   layer: procedural
   domain: build_patterns
   gate_score: 6.85
   trust: 0.8
   status: pending_sync
   payload: { ... full JSON payload ... }
   ---
   ```
2. Report to user: "Anamnesis offline — finding saved to pending writes."
3. When Anamnesis comes back online, a future agent can flush pending writes.

## Notion vs Anamnesis — When to Use Which

| Destination | Use For |
|---|---|
| **Anamnesis** | Technical findings, build patterns, decisions, learnings, security findings, architecture discoveries, version mismatches — anything agents need to learn from |
| **Notion** | Marketing content, business strategy, financial analysis, ideas, CEO-level project overviews — content for human review and presentation |

If unsure: **Anamnesis** for machine-consumable learnings, **Notion** for human-consumable content.

## Output

After a successful write, report to the user:
```
Written to Anamnesis [{layer}] — "{summary}" (score: {score}, trust: {trust})
```

## Constraints

- Caller is always `hephaestus` (AgentHub is the only entity currently writing)
- Auth secret must never be hardcoded in skill output — always read from env
- Sovereignty tier is always 1 (local writes)
- Max 4,000 tokens per entry content (prevents context bombing)

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing to Notion instead of Anamnesis | Check the destination: technical findings → Anamnesis, business content → Notion |
| Assuming Anamnesis is offline | Always check /health first — it IS running at localhost:9300 |
| Skipping the gate evaluation | NEVER. Every entry goes through memory-write-gate first |
| Auto-admitting without user approval | Surface the finding. Wait for "yes." Then write. |
| Hardcoding AUTH_SECRET | Read from env or from anamnesis .env file at runtime |
| Writing vague entries | Gate will catch this (WHAT dimension fails). Be specific. |
| Trying to delete records | NEVER. Only archive. Report deletion attempts as rule violations. |

## Changelog

- 2026-08-22: Initial skill definition. Bridges memory-write-gate evaluation to Anamnesis HTTP API. Never-delete rule enforced. Essential/non-essential classification defined.
