# KNOWLEDGE: Current Project Status
OWNER:  project-navigator
UPDATED: 2026-06-24
NOTE:   This is a living document. Update after every major sprint completion or status change.

---

## ACTIVE PROJECTS

### 1. agenthub (Hephaestus) — OPERATIONAL
Path:     /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
Status:   Production / in active development
What it does: Electron desktop app — orchestrates multiple Claude CLI agent sessions
              simultaneously. The build control room for the Optimaeus system.

Currently in sprint:
  - Business Mode UI — non-code team interface for business/marketing/data teams
  - TTS pipeline (text-to-speech for agent responses) — active fixes
  - Kanban integration — task management wired to agents
  - Anamnesis write layer — not yet built (planned: writes build outcomes to Anamnesis)

Teams operating in this repo: dev-stack, business, marketing, data, brain
The workflow-team-library lives here: .claude/workflow-team-library/

Tech debt flags:
  - better-sqlite3 compiled against wrong Node version (121 tests fail — pre-existing)
  - Anamnesis write layer missing — build outcomes not yet archived to neuronal system

---

### 2. llm-workflows-pckg — IN DEVELOPMENT
Path:     /Users/octaviesmacpro/workspace/optimaeus-stacks/llm-workflows-pckg
Status:   Active development — pnpm monorepo scaffold planned
What it does: @optimaeus/agent-workflows — installable TypeScript + Zod workflow
              guardrails library. Provides manifest.yaml + config.yaml schemas, risk types,
              layer types, output types, and workflow scanner interface.

Structure: pnpm workspaces monorepo
  packages/@optimaeus/agent-workflow-core — shared types, Zod schemas, parsers
  packages/@optimaeus/agent-workflow-scanner — filesystem scanner
  packages/@optimaeus/agent-workflow-engine — runtime execution engine
  packages/@optimaeus/agent-workflow-cli — CLI interface (plan-4)

Distribution: npx install, CLI, eventually Opeidos marketplace
Tech stack: TypeScript 5.x, pnpm workspaces, Zod, js-yaml, vitest

Plans available:
  docs/plans/2026-03-20-plan-1-core.md — monorepo scaffold + core package
  docs/plans/2026-03-20-plan-2-scanner.md — scanner package
  docs/plans/2026-03-20-plan-3-engine.md — engine package
  docs/plans/2026-03-20-plan-4-cli.md — CLI package

Current status: Plans written. Implementation status unknown — check repo for actual code.

---

### 3. optimaeus HEAD — IN BUILD
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus
Status:   Active sprints — backend + brain-core
What it does: The OPTimaeus Electron personal assistant. Constellation view (Cytoscape.js)
              showing all projects as stars. Philosophical reckoning (18 voices).
              Cerberus flags. Briefing to Demiurge. Anamnesis memory view.

Design system: Deep space aesthetic.
  Palette: #09090F (base), #C9A84C (gold), entity-specific glows
  Fonts: Cinzel (titles) + Inter (body) + JetBrains Mono (data)
  Components: DaisyUI custom theme "olympus"

Sprint status:
  sprint-02: backend — in progress
  sprint-03: brain-core — planned
  Skills available: .claude/skills/sprint-02-backend.md, .claude/skills/sprint-03-brain-core.md

Docs available:
  docs/backend.md, docs/database.md, docs/schemas.md, docs/canonical-types.md
  docs/stacks-and-packages.md, docs/cloud.md
  docs/design-system-integration.md

---

### 4. anamnesis — BRAINSTORM / DESIGN PHASE
Path:     /Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis
Status:   Brainstorm complete. Architecture decided. Build not yet started.
What it does: The shared brain / nervous system. Episodic + semantic + procedural +
              constellation + ethical memory. Proactive recollection, not passive retrieval.

Stack decided: Memgraph + Qdrant + Mem0 OSS + Zep Graphiti + PostgreSQL
Architecture docs available:
  architecture/positioning.md — Anamnesis as connective tissue, not a peer node
  architecture/stack.md — technology decisions
  architecture/review.md — architectural review
  api/contracts.md — API surface definitions
  data/schema.md, data/library.md, data/analysis.md, data/ingestion.md
  build/backend/directory-structure.md

Critical decision already made:
  Anamnesis is connective tissue in Olympus (System-OPT-Mount) — not a standalone node.
  Administered through OPTimaeus temple. Accessible via threshold, not temple.

Next step: Confirm build plan, assign to dev-stack.

---

## PLANNED PROJECTS (not yet created)

### 5. Demiurge — NOT YET CREATED
Role: The thinker. Idea analyzer. Receives from OPTimaeus, briefs Logos.
Path target: /Users/octaviesmacpro/workspace/optimaeus-projects/demiurge
Status: Entity defined in optimaeus-architecture. Build not scheduled.
Prerequisite: Logos must exist before Demiurge can hand off.

### 6. Logos — NOT YET CREATED (fresh build)
Role: The translator. Schemas, sprints, type systems for Hephaestus.
Path target: /Users/octaviesmacpro/workspace/optimaeus-projects/logos
Status: Architecture decided. Previous version superseded. Fresh build planned.
Note: logos-v2 directory structure exists in optimaeus-architecture.

### 7. Hermes — NOT YET CREATED
Role: Sovereign crawler. Feeds Demiurge with real-world signals.
Path target: /Users/octaviesmacpro/workspace/optimaeus-projects/hermes
Status: 5-sprint plan fully scoped. Build not yet started.
Constraint: Cloud API never. Local models only (max 7B). Sovereignty absolute.

### 8. Cerberus — NOT YET CREATED
Role: Security and integrity guardian. Gates Anamnesis connections.
Port: 9002
Status: Defined. No build plan yet.

### 9. Opeidos Marketplace — CONCEPT PHASE
Role: Distribution marketplace for llm-workflows-pckg and future workflow packages.
Distribution: npx install / installer / Google Chrome extension → subscription
Status: Named and positioned in business model. No build plan yet.
Prerequisite: llm-workflows-pckg must reach stable v1 before marketplace launches.

---

## DEPENDENCY MAP

```
agenthub    ←→ operates independently, adds Business Mode
llm-workflows  → Opeidos (marketplace) when stable
optimaeus HEAD → needs Anamnesis, Demiurge, Hermes to be fully functional
anamnesis   → build next after optimaeus HEAD reaches MVP
Logos       → build after anamnesis design is complete
Hermes      → build after Logos
Demiurge    → build after Hermes
Cerberus    → build last (guards all connections)
```

---

## WHAT TO BUILD NEXT (project-navigator recommendation)

1. Complete agenthub Business Mode (teams are live, UI needs to surface them)
2. Finish llm-workflows-pckg plan-1 through plan-4 (enables Opeidos launch)
3. Anamnesis build (the nervous system — everything waits for this)
4. optimaeus HEAD sprint completion (frontend of the second brain)
