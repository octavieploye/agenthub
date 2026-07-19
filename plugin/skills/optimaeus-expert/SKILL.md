---
name: optimaeus-expert
description: OPTimaeus expert — status report of what is built, the 3 P0 monetization blockers, build phase, architecture, and path to commercial launch. Reads live from /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus.
category: intelligence
---

# OPTimaeus Expert

On-demand status snapshot of OPTimaeus — the sovereign strategy console. What is built, what is blocking launch, and what the path to monetization looks like.

## When to Use

- "What is the status of OPTimaeus?"
- "What does OPTimaeus still need before we can sell it?"
- "What are the P0 blockers for OPTimaeus?"
- "Is OPTimaeus monetization-ready?"
- Any question about OPTimaeus features, architecture, or roadmap

## What You Need Before Starting

Read from:
- `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/` — actual project
- `README.md` and `DEVELOPMENT-PLAN.md` in that project — P0 blockers listed there
- `agenthub/docs/superpowers/plans/2026-07-08-optimaeus-*.md` — current plans
- `agenthub/docs/superpowers/specs/2026-07-08-optimaeus-*.md` — specs

## Known Baseline (as of 2026-07-13 — verify before citing)

**Version:** 1.0.0 | **Stack:** Electron + Python backend | **Phase:** V1 — late in-progress

### Built and Working
- 25 backend Python services (agent_service, prompt_compiler_service, memory_service, policy_guard_service, calibration_service, council_view_service, dashboard_service, decision_service, learning_service, project_service, registry_service, skill_service, versioning_service, worker_service, prose_renderer.py stub, activity_service, audit_service, 9 data adapters, secret_adapter, anamnesis_queue)
- 14 philosophical frameworks in brain core (Plato, Machiavelli, Arendt, Nietzsche, Coeus, Ma'at, Ubuntu, Lakota, Zarathustra, Seventh Generation, Hózhó, + 3 new lenses in plan)
- Bayesian probability engine with sourced priors (zone: Terminal / Speculative / Viable / Proven)
- Knowledge graph with versioning and trust labels
- SQLAlchemy + PostgreSQL + pgvector backend (7 schemas: brain_db, instruction_db, knowledge_library_db, learning_db, loop_db, audit_db, secret_store)
- Evaluation engine (5 business modes: idea, existing, lean, vc_diligence, strategic)
- Constellation view (knowledge graph UI with Cytoscape.js)
- Entity management, versioning, audit trail
- Admin panel for brain core management
- Electron desktop shell with auto-start/stop of Python backend
- LLM provider management (Ollama local, EU cloud Mistral, fallback)
- 25+ React components
- Docker Compose orchestration
- optimaeus_llm Python package wired (build_router("optimaeus"))

### P0 Monetization Blockers (from DEVELOPMENT-PLAN.md)

| Blocker | Impact | Current state |
|---|---|---|
| **1. Prose Renderer** | CRITICAL — without this the reckoning moment never happens | Stub exists (prose_renderer.py, 16KB) — not fully implemented. Evaluation returns raw JSON only |
| **2. Anamnesis Write Layer** | HIGH — no cross-session memory, no learning loop, no moat | anamnesis_queue_service.py exists but pipeline to Anamnesis backend incomplete |
| **3. PDF Export** | HIGH — M&A + family office buyers require exportable board-ready docs | Export router exists (routers/export.py) — PDF generation not implemented |

**Pre-Mortem First-Session UX (secondary P0):**
- Opening flow with prospective hindsight (Gary Klein mechanism)
- Reckoning Sentence rendering (amber border draw + fade)
- Spec complete in README but not implemented

### Plans Existing
- `2026-07-08-optimaeus-cyber-protection.md` — sovereignty + threat architecture (ready)
- `2026-07-08-optimaeus-positioning-cracks.md` — 5 positioning cracks defended (done)
- `2026-07-08-optimaeus-philosophical-lenses.md` — 3 new frameworks ready to add

### Architecture Guarantees (non-negotiable)
- LLMs never touch DB directly — all access via service layer
- instruction_db is user-only write
- All AI-accessible records versioned — no destructive updates
- Every tool call audit-logged before execution
- No AI self-approval gate
- Brain core runs in-process (no network call for rule selection)
- Sovereignty-first routing: Ollama local → Mistral EU → US cloud fallback

## Workflow

1. Confirm project exists at `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/`
2. Read `README.md` and `DEVELOPMENT-PLAN.md` — extract P0 blocker status
3. Check `services/` directory for: prose_renderer.py, anamnesis_queue_service.py, routers/export.py
4. Read relevant agenthub plan files for current plan status
5. Output structured report: BUILT / P0-BLOCKERS / PLANS / MONETIZATION-READINESS

## Output

Structured markdown report:
- Table: BUILT — domain, component, status
- Table: P0 BLOCKERS — blocker, impact, file, current state
- Table: PLANS — plan file, status
- Monetization readiness: percentage estimate + what changes it

## Constraints

- Always verify against live files at `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/`
- P0 blockers are hard gates — do not soften or reframe them
- Do not confuse prose_renderer.py stub with a working implementation — check file size and implementation depth
- Do not propose solutions — report state only. Recommendations go to ecosystem-orchestrator.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Saying OPTimaeus "doesn't exist" or "isn't built" | It IS built. Check the path. V1 is operational. |
| Saying Cerberus blocks OPTimaeus | Cerberus is not a blocker for OPTimaeus. It is a standalone product. |
| Treating Anamnesis write layer as "done" because queue service exists | The queue service is a stub — the full pipeline to Anamnesis backend is incomplete |
