# MANIFEST — Brain Team (Meta-Intelligence)
Version: 1.0
Role:    Cross-project intelligence, strategic orientation, and pre-session briefing
Scope:   Full Optimaeus ecosystem — all current and planned entities

## WHAT THE BRAIN TEAM IS

The brain team is the second brain the user described.
It knows everything about the Optimaeus ecosystem so that no session starts blind.
It does not research, build, or market. It thinks, remembers, and orients.

Before a business session: brain briefs on prior research and open questions.
Before a dev sprint: brain flags architecture conflicts and cascade dependencies.
Before a marketing session: brain surfaces persona data and prior campaign findings.
On demand: brain answers "what is the current state of everything?"

## TEAM MEMBERS
  lead-brain           — orchestrator, entry point for any cross-project question
  ecosystem-architect  — full technical architecture knowledge
  project-navigator    — current status of all active and planned projects
  strategy-advisor     — business model, monetization, roadmap sequencing
  memory-curator       — surfaces prior knowledge from memory folder + eventual Anamnesis

## KNOWLEDGE FILES (always available — updated after major milestones)
  brain/knowledge/philosophy.md       — the six cores of OPTimaeus, mythology, corruption test, sovereignty ethos
  brain/knowledge/ecosystem.md        — the Optimaeus neuronal system: all 7 entities
  brain/knowledge/projects-current.md — what is built, what is in sprint, what is planned
  brain/knowledge/business-model.md   — monetization model, phases, Opeidos, sovereignty

## OPERATIONS
  brain/ops/how-to-run.md             — when to call the brain team and what to expect

## LOAD ORDER
1. lead-brain loads this manifest
2. lead-brain loads knowledge/ files relevant to the request (not all three unless needed)
3. lead-brain routes to specialist(s) based on request type
4. For memory requests: memory-curator loads workflow-team-library/memory/index.md first

## TRIGGER CONDITIONS

  ALWAYS trigger brain team when:
  - A new project or sprint is starting for the first time
  - A cross-entity decision is needed ("should X go in Logos or Hephaestus?")
  - A new team member (human or agent) needs onboarding on the ecosystem
  - The user asks "where are we?", "what's the plan?", or "remind me of the architecture"
  - A business/marketing session is about to start and prior work may exist in memory

  OPTIONALLY trigger brain team when:
  - Architectural decisions need strategic context ("is this the right direction for Opeidos?")
  - Sprint sequencing advice is needed across projects
  - A new feature needs to be placed within the right entity

## WHAT THE BRAIN TEAM DOES NOT DO
  - Write code (→ dev-stack)
  - Conduct business research (→ business team)
  - Run marketing analysis (→ marketing team)
  - Archive session data (→ data team)
  - Make final decisions (→ user is always the decision-maker)

## RELATIONSHIP TO ANAMNESIS

The brain team is the human-facing bridge until Anamnesis is live.
memory-curator interfaces with the temporary memory folder today.
When Anamnesis launches, memory-curator will query Anamnesis directly.
The knowledge/ files in this folder are a simplified version of what Anamnesis will hold
as semantic + procedural memory. When Anamnesis is ready, these files migrate there.

## TOKEN BUDGET
  knowledge/philosophy.md:        ~600 tokens (ALWAYS load — required for brainstorm co-chair)
  knowledge/ecosystem.md:         ~600 tokens (load when architecture questions arise)
  knowledge/projects-current.md:  ~500 tokens (load when project status is needed)
  knowledge/business-model.md:    ~400 tokens (load when strategy/monetization is needed)
  memory/index.md:                 grows with records (loaded by memory-curator only)
  Maximum in context at once:      ~3,000 tokens (tight — load what is needed, not all four)
