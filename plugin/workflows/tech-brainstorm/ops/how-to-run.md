# MODULE: tech-brainstorm/ops/how-to-run
TYPE:   Operations — read by lead-tech-brainstorm at session start
OWNER:  lead-tech-brainstorm

---

## PREREQUISITE CHECK

Before starting: confirm the Idea Brief is present and user-approved.
  - Load from memory/records/brainstorm/IDEA-[id].md
  - Confirm status: approved
  - If not approved: STOP. Return to general brainstorm session to complete the Idea Brief first.

---

## SESSION FLOW: 9 PHASES

### PHASE 1 — BRIEF (Brain orientation + Idea Brief load)

  1. lead-tech-brainstorm loads the approved Idea Brief
  2. lead-brain loads philosophy.md — ALWAYS, before anything else
  3. ecosystem-architect loads ecosystem.md — reads the current cascade architecture
  4. project-navigator loads projects-current.md — confirms sprint status, no conflicts
  5. memory-curator checks: any FEAT records related to this product/feature area?
  6. lead-brain delivers Technical Orientation Package:
       - Cascade position of the target entity
       - Current sprint status (what is already in flight)
       - Relevant architectural decisions already made
       - Sovereignty constraints specific to this entity
       - Any prior tech-brainstorm records touching this area

Output: Technical Orientation Package
---

### PHASE 2 — PLACE (cascade placement)

  1. feature-architect + ecosystem-architect (Brain) work together:
       - Which entity owns this feature? (agenthub / optimaeus / anamnesis / llm-workflows-pckg)
       - Where in the cascade does it sit?
       - What API boundaries does it cross?
       - Which DB does it touch? (SQLite for agenthub/hermes, PostgreSQL for others)
       - Does it require a new inter-entity contract?
  2. Placement is confirmed before ideation begins — avoids building in the wrong entity

Output: Placement Decision (entity, DB, API boundary, cascade position)
---

### PHASE 3 — IDEATE (technical approaches)

  feature-architect produces 2-3 technical approaches based on the Placement Decision.
  sr-backend and sr-frontend evaluate each approach in parallel:

  For each approach:
    feature-architect: architecture + cascade compliance + corruption test
    sr-backend:        API design, DB schema, migration risk, sovereignty compliance
    sr-frontend:       Frontend integration, Electron constraints, state management impact

  Rules:
    Never fewer than 2 approaches. Never more than 3.
    Every approach is checked against the corruption test before being presented.
    Approaches that introduce adversarial infrastructure are flagged, not silently included.

Output: Technical Approaches Set (2-3 approaches, each assessed by all three roles)
---

### PHASE 4 — UX (UX directions)

  ux-explorer produces 2-3 distinct UX directions independently of the technical approaches.
  sr-frontend checks each direction for technical feasibility.

  For each UX direction:
    ux-explorer:  user flow, interaction pattern, component concept, aesthetic fit
    sr-frontend:  feasibility score (HIGH / MEDIUM / LOW) + one-sentence reason

  Aesthetic constraints:
    agenthub:       forge amber (#E8642A), dark interface, agent-centric
    optimaeus HEAD: deep space (#09090F), gold (#C9A84C), Cinzel titles, constellation aesthetic
    anamnesis:      neural blue (#6EA8FE), graph-native, memory-first
    llm-workflows:  CLI-first — UX is command-line, no visual UI

Output: UX Directions Set (2-3 directions with feasibility checks)
---

### PHASE 5 — VALIDATE (dev-stack risk review)

This phase brings in dev-stack's architect and dev-backend as read-only reviewers.
They do NOT build at this stage. They surface what the build team would need to know.

  architect (dev-stack):
    - Is the proposed approach actually buildable given existing architecture?
    - What is the real complexity (not the ideation estimate)?
    - Are there cascade risks not yet surfaced?
    - What would break if we got this wrong?

  dev-backend (dev-stack):
    - Is the DB design sound? Any migration risks?
    - Are the API surfaces realistic given existing contracts?
    - What are the performance implications?
    - Any breaking changes to existing functionality?

Output: Risk Register (per approach — see Feature Brief template Section 5)
---

### PHASE 6 — SIGNAL (Proactive Signal Protocol — technical layer)

idea-challenger equivalent in tech-brainstorm context = feature-architect + sr-backend.
All 7 standard signals are checked. Technical signals added:

  Standard 7 signals (see proactive-signal-protocol.md)
  +
  TECHNICALLY INFEASIBLE:  Approach cannot be built within current cascade constraints
  CASCADE VIOLATION:       Approach breaks inter-entity data flow rules
  BREAKING CHANGE:         Approach breaks existing contracts without a migration path
  SOVEREIGNTY BREACH:      Approach introduces AWS/Firebase/adversarial dependency

strategy-advisor (Brain) confirms sovereignty verdict.
ecosystem-architect (Brain) confirms cascade compliance.

Output: Technical Signal Report
---

### PHASE 7 — SYNTHESIZE (Feature Brief)

  1. lead-tech-brainstorm fills out the Feature Brief template
       (tech-brainstorm/ops/feature-brief-template.md)
  2. Recommended technical approach: the one that best balances feasibility, sovereignty, and user need
  3. Recommended UX direction: the one that best fits the product aesthetic and technical approach
  4. Risk Register consolidated from Phase 5 + Signal Report from Phase 6
  5. strategy-advisor (Brain) confirms sovereignty verdict
  6. lead-brain co-signs: "Ecosystem and philosophy check complete"

Output: Draft Feature Brief
---

### PHASE 8 — APPROVE (user)

  1. lead-tech-brainstorm presents the Feature Brief to the user
  2. User reviews:
       - Technical approach options (A / B / C) → selects one
       - UX direction options (1 / 2 / 3) → selects one
       - Risk Register — any blockers before dev-stack can start?
       - Sprint size estimate — is this one sprint or should it be decomposed?
  3. User approves Feature Brief
  4. lead-tech-brainstorm hands Feature Brief to dev-stack lead for sprint planning

Output: Approved Feature Brief
---

### PHASE 9 — DEPOSIT (data team)

  1. lead-tech-brainstorm notifies lead-data: "Feature Brief [FEAT-ID] approved — deposit"
  2. data-architect creates FEAT record in memory/records/tech-brainstorm/
  3. data-architect adds row to memory/index.md
  4. project-navigator (Brain) updates projects-current.md:
       - Notes new approved feature for the relevant entity
       - Notes new sprint planned (tentative until dev-stack confirms)
  5. Pattern check if 5th deposit since last check

---

## SESSION FAILURE STATES

  No Idea Brief → STOP. Return to brainstorm team first.
  Approach is technically infeasible → surface to user, explore Option B or C.
  All approaches fail cascade compliance → flag to user. May need re-scoping at brainstorm level.
  UX directions all unfeasible → ux-explorer + sr-frontend iterate (max 2 rounds before escalating).
  Dev-stack raises a hard blocker → note in Risk Register, present to user before proceeding.
