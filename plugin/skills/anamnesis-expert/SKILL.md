---
name: anamnesis-expert
description: Anamnesis system oracle — DB schemas, memory layers, API contracts, entity connections, build state, competitive positioning, and integration status. Reads live from both repos.
category: business-intelligence
---

# Anamnesis Expert

On-demand knowledge oracle for the Anamnesis memory system — architecture, DB schemas, API contracts, memory layers, entity connections, build state, competitive landscape, and Hephaestus integration.

## When to Use

- "What is Anamnesis?" / "How does Anamnesis work?"
- "What is the status of Anamnesis?"
- "What are the Anamnesis DB schemas?"
- "How does Hephaestus connect to Anamnesis?"
- "What endpoints does Anamnesis expose?"
- "What memory layers exist?"
- "How do I write to / read from Anamnesis?"
- Any question about Anamnesis architecture, deployment, competitive positioning, or integration
- When planning work that touches the Anamnesis write layer in AgentHub
- When building features that need persistent agent memory

## What You Need Before Starting

No external input required. Read from these locations:

**Anamnesis repo** (primary source of truth):
- `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis/` — full codebase
- `build/backend/src/anamnesis/` — FastAPI services, routes, models, migrations
- `clients/typescript/src/` — TypeScript client SDK
- `clients/python/anamnesis_client/` — Python client SDK
- `api/contracts.md` — API contract spec
- `build/backend/pyproject.toml` — dependencies
- `docs/` — architecture docs, investigation reports

**AgentHub repo** (integration layer):
- `src/main/services/anamnesis-writer.ts` — Hephaestus write bridge
- `src/main/services/adapters/anamnesis-adapter.ts` — adapter interface
- `src/main/db/migrations/023-task-events-cascade.sql` — cascade sync flags
- `src/main/services/service-orchestrator.ts` — startup wiring

**Architecture repo** (entity definition):
- `optimaeus-architecture/.claude/entities/anamnesis.md` — philosophical design
- `optimaeus-architecture/shared/UNIVERSAL-STANDARDS.md` — schemas, ports, naming

**Memory files** (strategic context, may be stale):
- `.claude/projects/.../memory/reference_anamnesis_state_july2026.md`
- `.claude/projects/.../memory/project_anamnesis_*.md`
- `.claude/projects/.../memory/reference_anamnesis_competitive_synthesis.md`

## System Architecture

### Position in Neuronal Cascade

```
OPTimaeus (HEAD) -- reads Anamnesis only
      ^
  Anamnesis -- receives from three, serves one
  ^         ^         ^
Demiurge -> Logos -> Hephaestus   (cascade direction)
      ^
  Hermes (sovereign crawler)
```

- Three entities WRITE to Anamnesis: Demiurge, Logos, Hephaestus
- One entity READS from Anamnesis: OPTimaeus
- Anamnesis writes to NOTHING. It receives, consolidates, serves.
- Currently only Hephaestus exists as a live entity (AgentHub)

### Tech Stack

| Component | Technology | Port | Purpose |
|---|---|---|---|
| API | FastAPI (Python 3.12+, async) | 9300 | REST API |
| Relational | PostgreSQL (asyncpg, schema: `memory`) | 5432 | Episodic, ethical, procedural, intelligence |
| Graph | Memgraph (Bolt protocol) | 7687 | Constellation map |
| Vector | Qdrant (REST) | 6333 | Semantic search, 768-dim embeddings |
| Embeddings | Ollama nomic-embed-text | 11434 | Local embedding generation |
| Migrations | Alembic (async) | - | Schema versioning |
| Auth | X-Optimaeus-Caller + Bearer token | - | Entity identification + secret |

### 7 Memory Layers

| Layer | Storage | What It Holds |
|---|---|---|
| **Episodic** | PostgreSQL (`episodic_events`) | What happened, when, on which project. Timeline events. |
| **Semantic** | PostgreSQL + Qdrant | Patterns extracted from many episodes. Earned domain knowledge. |
| **Procedural** | PostgreSQL (`procedural_index`) + Qdrant | What worked. Build patterns, sprint structures, schema patterns. |
| **Constellation** | Memgraph | Living project topology. Tasks as stars, dependencies as gravity. |
| **Ethical** | PostgreSQL (`ethical_records`) + Qdrant | OPTimaeus conscience. Drift detections, corruption test results. |
| **Shadow** | Qdrant | Intermediate findings awaiting ethical review. |
| **Intelligence** | PostgreSQL (`intelligence_verdicts`, `intelligence_source_reputation`) | Cerberus quarantine verdicts, source reputation. |

### PostgreSQL Tables (schema: `memory`)

```
episodic_events           -- time-ordered event log
ethical_records            -- corruption test results, drift detections
procedural_index           -- promoted build patterns
consolidation_runs         -- consolidation job history
intelligence_verdicts      -- Cerberus quarantine verdicts
intelligence_source_reputation -- source credibility tracking
contradictions             -- plan-vs-reality gap tracking
```

### Qdrant Collections (768-dim nomic-embed-text)

```
analyses          semantic_proximity
schemas           build_outcomes
market_signals    shadow_findings
ethical_flags     procedural_patterns
```

### Memgraph Graph Schema

```
Nodes:    Project (PascalCase labels)
Edges:    GRAVITATIONAL_PULL, SEMANTIC_PROXIMITY, RECURRING_TENSION (SCREAMING_SNAKE_CASE)
Props:    entity_id, created_at (snake_case)
```

## API Endpoints

### Write Routes (POST /memory/{layer})

| Endpoint | Allowed Callers | Key Fields |
|---|---|---|
| `POST /memory/episodic` | demiurge, logos, hephaestus, optimaeus, cerberus | source_entity, project_id, content |
| `POST /memory/semantic` | demiurge, hermes, hephaestus | source_entity, domain, content |
| `POST /memory/procedural` | logos, hephaestus | source_entity, domain, source, content |
| `POST /memory/constellation` | demiurge, hephaestus | source_entity, project_id, content |
| `POST /memory/ethical` | logos, optimaeus, hephaestus | source_entity, content |
| `POST /memory/shadow` | logos, hephaestus | source_entity, content |
| `POST /memory/intelligence` | cerberus, hephaestus | domain, verdict, content, source_url, confidence, project_id |

### Read Routes (GET)

| Endpoint | Allowed Callers | Returns |
|---|---|---|
| `GET /memory/context` | optimaeus, hephaestus | Composite: episodic + semantic + procedural + constellation + ethical |
| `GET /memory/constellation` | optimaeus, hephaestus | Project topology graph |
| `GET /memory/ethical` | optimaeus, hephaestus | Ethical records |
| `PATCH /memory/ethical/{id}/resolve` | optimaeus, hephaestus | Resolve ethical flag |
| `GET /memory/procedural` | optimaeus, logos, hephaestus | Procedural patterns (filterable by domain) |
| `GET /memory/shadow` | optimaeus, hephaestus | Unreviewed shadow findings |
| `GET /memory/intelligence/verdicts` | optimaeus, hephaestus | Cerberus verdicts |
| `GET /memory/intelligence/reputation/{domain}` | optimaeus, demiurge, hephaestus | Source reputation |
| `GET /memory/contradiction` | optimaeus, hephaestus | Active contradictions |
| `PATCH /memory/contradiction/{id}/resolve` | optimaeus, hephaestus | Resolve contradiction |

### Other Routes

| Endpoint | Purpose |
|---|---|
| `GET /health` | Store health check (postgres, memgraph, qdrant, embedding model) |
| `POST /consolidate` | Trigger consolidation (episodic -> semantic -> procedural promotion) |

### Auth Headers

```
X-Optimaeus-Caller: hephaestus     # entity identification
Authorization: Bearer {AUTH_SECRET}  # shared secret from env
Content-Type: application/json
```

## Hephaestus (AgentHub) Integration

### Writer (ACTIVE)

- **File**: `src/main/services/anamnesis-writer.ts`
- Circuit breaker: 3 failures -> 60s backoff
- Batch polling: 10 events/flush
- Auth: `X-Optimaeus-Caller: hephaestus`

**Event routing**:
| Event | Endpoint |
|---|---|
| `CARD_TRANSITION` | `POST /memory/episodic` |
| `CARD_COMPLETED` | `POST /memory/procedural` |
| `CARD_INTERRUPTED` | `POST /memory/procedural` |
| `SPRINT_INTAKE` | `POST /memory/episodic` |

**Config**: `ANAMNESIS_URL` defaults to `http://localhost:9300`, auth via `AUTH_SECRET` env var.

### Adapter Pattern

- `src/main/services/adapters/anamnesis-adapter.ts` — interface + `NullAnamnesisAdapter` for standalone mode
- `src/main/db/migrations/023-task-events-cascade.sql` — task_events table with `synced_to_anamnesis` and `enriched_from_anamnesis` flags
- `src/main/services/service-orchestrator.ts` (line ~358-361) — creates adapter at startup, calls flush()

### Payload Transformer (commit dcb9445)

- `src/main/services/anamnesis-payload-transformer.ts` — transforms kanban task events into Anamnesis write payloads
- Agent memory setup for structured writes

### Project ID Mapping

Repo path -> project_id via deterministic UUID5:
```
project_id = uuid5(NAMESPACE_URL, repo_path)
// e.g., "/Users/.../agenthub" -> always same UUID
```

### TypeScript Client SDK

Located at: `anamnesis/clients/typescript/src/`
- `client.ts` — AnamnesisClient class (660+ lines)
- `models.ts` — all write/read models with TypeScript types
- `exceptions.ts` — typed errors

```typescript
import { AnamnesisClient } from 'anamnesis-client';

const client = new AnamnesisClient('hephaestus', {
  baseUrl: 'http://localhost:9300',
  authSecret: process.env.AUTH_SECRET!
});

await client.writeEpisodic({ source_entity: 'hephaestus', project_id: '...', content: {...} });
const context = await client.getContext();
const health = await client.health();
```

## Build State

### Completion (verified 2026-08-08, may have changed)

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Infrastructure + API skeleton | 100% |
| Phase 2 | Write routes (all 7 layers) | 100% |
| Phase 3 | Intelligence routes (Cerberus) | 90% |
| Phase 4 | Read routes (OPTimaeus) | 85% |
| Phase 5 | Consolidation engine | 80% |
| Phase 6 | Client SDKs | 50% |

### What's Done
- Architecture, spec, DB schema, Alembic migrations: 100%
- FastAPI app factory with full lifespan: 100%
- Auth middleware: 100%
- Writer service (350 lines, all 7 layers): 100%
- Reader service (541 lines, context assembly): 85%
- Embedder service (86 lines, Ollama model discovery): 85%
- Consolidator service (191 lines, pattern extraction + decay): 80%
- Contradiction runner (163 lines): partial
- Scheduler (56 lines, APScheduler + PG job store): partial
- Test suite: 182 tests, 80.37% coverage (after Phase 1 optimization)
- Python client SDK: done
- TypeScript client SDK: done

### What's NOT Done
1. End-to-end integration testing with other entities
2. Client SDK publication (PyPI, npm)
3. Production deployment (no Docker compose, no monitoring)
4. Consolidation failure resume logic
5. Performance tuning
6. OPTimaeus frontend integration
7. Hermes/Cerberus integration (routes exist, writers not built)
8. Proactive surfacing (push model deferred)
9. Multi-tenant isolation (P0 blocker for SaaS)

### Memory Graph Optimization (2026-08-19)

Phase 1 + P0 + P1 COMMITTED (a406851):
- Memory-as-Governance (pre-action gate)
- Temporal edges (valid_at/expired_at)
- Memory poisoning defense (OWASP ASI06)
- Project-scoped visibility enforcement
- Model-agnostic format (markdown output)
- Decay scoring enhancement
- 182 tests, 80.37% coverage
- Verdict: PASS -- safe to connect AgentHub

Remaining:
- Phase 2: contradiction-on-write
- Phase 3: MRAgent active reconstruction, OPTimaeus reviewer

## Deployment Strategy

### Dual Delivery Model (decided 2026-08-08)

**Model A — Self-Hosted**: Docker Compose (PG + Memgraph + Qdrant + FastAPI). Customer runs on own infra. One-time purchase or annual license. Full sovereignty (Tier 1).

**Model B — Hosted SaaS**: OVH Gravelines (France). Subscription pricing. API + MCP server for any AI tool. Sovereignty Tier 2 (EU cloud). Open to external tools.

### MCP Server (confirmed)

8 tools: remember, learn, record_procedure, recall, search_procedures, check_drift, health, consolidate

### P0 Blockers for SaaS Launch

1. Multi-tenant PostgreSQL (RLS or per-schema)
2. Per-tenant Qdrant namespace isolation
3. Memgraph tenant isolation
4. JWT/API key auth (replace shared secret)
5. OVH Docker Compose deployment
6. Billing integration (LemonSqueezy/Stripe)
7. Article 28 DPA publication

### Pricing Strategy

```
Free     EUR 0     Local Anamnesis, 3-store stack, basic recall, no consolidation
Builder  EUR 19    Graph at all tiers (Mem0 locks behind $249)
Team     EUR 89    Multi-entity cascade, constellation graph, DPA
Pro      EUR 149   Full consolidation, ethical layer, decay logic
Enterprise EUR 299+ On-prem, SCIM, EU AI Act compliance, SLA
```

## Competitive Landscape

### Unique Moats (zero competitors have ALL)

1. 5 structured memory layers (not flat key-value)
2. Contradiction detection (async runner)
3. Ethical oversight layer (corruption tests, Shadow findings)
4. Intelligence layer (Cerberus quarantine verdicts)
5. Cascade architecture (4 entity writers)
6. Real Memgraph graph (not entity linking like Mem0)
7. Self-hosted = 100% feature parity
8. Zero LLM in API path (embedding only)
9. EU sovereignty tier 1

### Key Competitors

| Competitor | Funding | Threat Level | Key Weakness |
|---|---|---|---|
| Mem0.ai | $24.5M | HIGH (distribution) | Fake graph, US-only, $19->$249 gap |
| KnowMind.de | EUR 0 | LOW | Storage not intelligence, zero distribution |
| Zep/Graphiti | Unknown | MEDIUM | Temporal graph, no ethical layer |
| Letta/MemGPT | $10M | MEDIUM | OS-paging model, no multi-entity |
| Cognee (Berlin) | EUR 7.5M | WATCH | EU competitor, needs deep audit |
| Interloom (Munich) | EUR 14.2M | WATCH | EU competitor, needs deep audit |

## Naming Conventions (from UNIVERSAL-STANDARDS.md)

```
Database file:    anamnesis (PostgreSQL)
Schema:           memory
Tables:           snake_case plural (episodic_events, ethical_records)
Columns:          snake_case (source_entity, created_at)
Primary key:      id UUID DEFAULT gen_random_uuid()
Foreign keys:     {table_singular}_id UUID
Timestamps:       {verb}_at TIMESTAMPTZ (created_at, validated_at)
JSONB:            {name} JSONB (no _json suffix)
Graph nodes:      PascalCase (Project)
Graph edges:      SCREAMING_SNAKE_CASE (GRAVITATIONAL_PULL)
Status strings:   Universal vocabulary (queued, pending, in_progress, done, failed...)
```

## Workflow

1. Identify what aspect of Anamnesis the question targets (architecture / DB / API / integration / build state / competitive / deployment)
2. Read the relevant files from the correct repo:
   - Architecture/philosophy -> `optimaeus-architecture/.claude/entities/anamnesis.md`
   - DB schemas -> `anamnesis/build/backend/src/anamnesis/db/` + migrations
   - API contracts -> `anamnesis/api/contracts.md` + route files
   - Services -> `anamnesis/build/backend/src/anamnesis/services/`
   - Hephaestus integration -> `agenthub/src/main/services/anamnesis-*.ts`
   - Build state -> read tests, services, check git log
   - Competitive -> memory files (may be stale, verify dates)
3. Cross-reference with UNIVERSAL-STANDARDS.md for naming and schema rules
4. Output structured answer with file:line references where applicable
5. Flag any information from memory files as "last verified [date]" if >3 days old

## Output

Structured markdown answer addressing the specific question. Include:
- File paths and line references for code claims
- Dates for any build state or strategic claims
- Staleness warnings for information from memory files
- Links to related docs for deeper reading

## Constraints

- Always verify against current file state — the baseline above is a snapshot, not live truth
- Never claim a service is "working" without confirming the file exists
- Memory files about competitive landscape and strategy may be stale — check dates
- Do not propose implementation changes — report state only
- For Anamnesis repo work, confirm repo target with user (separate repo from agenthub)
- The MCP server is confirmed but may not be built yet — verify before claiming it exists
- Hephaestus permission changes (Sprint 1) may or may not be applied — check actual route files

## Common Mistakes

| Mistake | Fix |
|---|---|
| Treating Anamnesis as a database | It is a 5-layer memory system with consolidation, graph, and vector stores |
| Calling Anamnesis endpoints directly from renderer | All calls go through main process services (anamnesis-writer.ts, adapter) |
| Assuming all entities can write to all layers | Check permission matrix — each layer has specific allowed callers |
| Using `vi.mock()` for Anamnesis adapter in tests | Use `NullAnamnesisAdapter` — it is the real standalone-mode adapter |
| Confusing Anamnesis repo path with agenthub | Anamnesis: `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis`. AgentHub: `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub` |
| Hardcoding model names for embeddings | Model discovery is runtime via Ollama — never hardcode |
| Mixing up api/contracts.md with actual code | Code is authoritative — contracts.md may lag behind |
| Assuming multi-tenant exists | Single-tenant only in current build — multi-tenant is P0 blocker for SaaS |
