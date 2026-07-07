# KNOWLEDGE: Optimaeus Neuronal System
OWNER:  ecosystem-architect
UPDATED: 2026-06-24
SOURCE: optimaeus-architecture/ entity definitions + UNIVERSAL-STANDARDS.md

---

## THE SYSTEM IN ONE SENTENCE

Five entities. Each has its own brain, role, and database.
Data flows forward through a cascade. OPTimaeus reads everything at the top.
No entity reaches into another entity's database directly.

---

## CASCADE ARCHITECTURE

```
OPTimaeus (HEAD) — philosophical overseer, reads Anamnesis only
      ↑
  Anamnesis — the nervous system, receives from three, serves OPTimaeus
  ↑         ↑         ↑
Demiurge  Logos  Hephaestus    (all three write to Anamnesis)
      ↑
  Hermes (sovereign crawler — upstream of Demiurge)
```

Cascade direction: Hermes → Demiurge → Logos → Hephaestus → Anamnesis → OPTimaeus
Data flows forward. No entity reaches back.

---

## ENTITY DEFINITIONS

### OPTimaeus — THE HEAD
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus
Stack:    Electron + React + Tailwind/DaisyUI + Cytoscape.js + Python FastAPI backend
Port:     8000 (backend)
DB:       PostgreSQL — schema: brain_core, instruction_db, memory
Role:     Philosophical overseer and personal assistant. The constellation view (Cytoscape.js)
          shows all projects as living stars in deep space. Each project can be briefed to
          Demiurge, evaluated ethically (18 philosophical voices), and reviewed by Cerberus.
          Reads Anamnesis in full — the only entity with full brain-state access.
Status:   In build — sprint-02 backend + sprint-03 brain-core underway
Design:   Deep space aesthetic. Colors: #09090F (space), #C9A84C (gold), #6EA8FE (Anamnesis blue).
          Fonts: Cinzel (titles), Inter (body), JetBrains Mono (data/logs).
          Glyph: Eye within a sun disk.

Named exception to "reads Anamnesis only": OPTimaeus also reads Forgejo wiki for project briefs
(read-only Forgejo client — documented in architecture).

---

### Anamnesis — THE NERVOUS SYSTEM
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis
Stack:    Python FastAPI + Memgraph (graph) + Qdrant (vectors) + Mem0 OSS + Zep Graphiti
Port:     9300
DB:       PostgreSQL (schema: memory) + Memgraph + Qdrant
Role:     The shared brain. Receives build outcomes (Hephaestus), schemas/ADRs (Logos),
          market signals (Demiurge). Surfaces relevant prior knowledge proactively — does not
          wait to be queried. Five memory layers:
            episodic      — what happened, when, on which project
            semantic      — accumulated knowledge, patterns, market signals
            procedural    — reusable templates, build patterns, sprint structures
            constellation — the living graph of all projects (nodes, relationships, risks)
            ethical       — drift events, OPTimaeus flags, council decisions (never decays)
          Architectural position: connective tissue, not a peer node.
          Administered through OPTimaeus's temple — no standalone UI.
Status:   Brainstorm complete. Build planning stage.
Corruption vector: must never become surveillance. Stores project intelligence,
          not personal intelligence. No behavioral telemetry. All data exportable.

---

### Hephaestus — THE BUILDER
Path:     /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
Stack:    Electron + React + Tailwind/DaisyUI + better-sqlite3 (SQLite)
Port:     9400
DB:       agenthub.db (SQLite)
Role:     Command and control for AI coding agents. Runs multiple Claude CLI sessions
          simultaneously. Orchestrates dev-stack, business, marketing, data, brain teams.
          Writes build outcomes, code patterns, agent learnings to Anamnesis (not yet implemented).
Status:   Operational at v1.0+. Adding Business Mode (non-code team UI).
Color:    #E8642A forge amber-orange. Glyph: geometric anvil.
LLM:      buildRouter("hephaestus") — quick thinking, EU-only cloud, model-agnostic.

---

### Logos — THE TRANSLATOR
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/logos (fresh build)
Stack:    Python FastAPI + PostgreSQL
Port:     9100
DB:       PostgreSQL — schema: instruction_db
Role:     Receives briefs from Demiurge, translates them into confirmed sprint packages
          for Hephaestus. Builds schemas, ADRs, sprint structures, type systems.
          The rational translation layer between thinking (Demiurge) and building (Hephaestus).
Status:   Architecture decided. Build not yet started (fresh build — previous version superseded).
Color:    #C8C8E0 silver-white. Glyph: Lambda (λ) inside a circle.

---

### Demiurge — THE THINKER
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/demiurge (not yet created)
Stack:    Python FastAPI + PostgreSQL
Port:     9200
DB:       PostgreSQL — schema: instruction_db, brain_core
Role:     The idea analyzer. Receives project ideas from OPTimaeus, conducts deep analysis,
          produces briefs for Logos. Runs the constellation map. Accesses Hermes crawl results.
          Deep thinking level LLM (never US/CN cloud for adversarial analysis).
Status:   Not yet created. Defined in entity files.
Color:    #7B2FBE electric indigo/violet. Glyph: Dodecahedron outline.

---

### Hermes — THE CRAWLER
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/hermes (not yet created)
Stack:    Python FastAPI + SQLite (hermes.db)
Port:     9000
DB:       hermes.db (SQLite)
Role:     Sovereign web crawler. Upstream of Demiurge — feeds real-world signals.
          Cloud API: never (cloud_api="never"). Veracity must be sovereign.
          Model ceiling: 7B. Only local models (Ollama).
Status:   Architecture planned (5 sprints scoped). Build not yet started.
Color:    #00C9E4 electric cyan. Glyph: Caduceus simplified.

---

### Cerberus — THE GUARDIAN
Path:     Not yet created
Port:     9002
Role:     Security and integrity gate. Guards connections to Anamnesis. Monitors every
          channel through which entities write to the shared brain.
Status:   Defined. Not yet created.
Color:    #C41E3A deep crimson. Glyph: Three-point gate symbol.

---

## SHARED INFRASTRUCTURE

Forgejo (self-hosted git + wiki):
  forgejo.local/ — two organisations
    optimaeus/ — narrative workspace (wiki-driven, briefs, plans, specs)
    hephaestus/ — technical workspace (code, agent commits, PRs)

Port registry:
  OPTimaeus: 8000 | MLX: 8080 | Hermes: 9000 | Logos: 9100
  Demiurge: 9200 | Anamnesis: 9300 | Hephaestus: 9400 | Cerberus: 9002 | Forgejo: 3000

LLM routing: all calls via buildRouter() from shared optimaeus-llm package.
  Never hardcode model names. Never call Ollama/Mistral/Anthropic endpoints directly.
  Provider priority: MLX local → Ollama local → Mistral (EU) → Anthropic (EU)
  Hermes: local only. Demiurge adversary analysis: local only. OPTimaeus ethics: local only.

Sovereignty rule (non-negotiable):
  No AWS. No Firebase. No Supabase. No Vercel. No PlanetScale.
  All artifacts must be deployable on infrastructure the builder owns.

---

## CASCADE BUILD ORDER (not yet completed)

Phase 0: Shared packages ✓ (optimaeus-llm-ts, optimaeus-llm-py, cloud-models.yaml, learning/skill schemas)
Phase 1: Hephaestus (agenthub) ✓ operational
Phase 2: OPTimaeus HEAD — in build
Phase 3: Hermes — architecture ready, build not started
Phase 4: Logos — fresh build, not started
Phase 5: Anamnesis — brainstorm complete, build planning
Phase 6: Demiurge — defined, not created
Phase 7: Cerberus — defined, not created
Phase 8: Full cascade integration
