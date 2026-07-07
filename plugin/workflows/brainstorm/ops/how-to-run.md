# MODULE: brainstorm/ops/how-to-run
TYPE:   Operations — read by lead-brainstorm at session start
OWNER:  lead-brainstorm

---

## SESSION FLOW: 9 PHASES

### PHASE 1 — ORIENT (Brain team)

Trigger: user presents an idea of any kind.

  1. lead-brainstorm opens session and requests Brain team orientation
  2. lead-brain loads philosophy.md — ALWAYS, before anything else
  3. ecosystem-architect loads ecosystem.md — confirms which entities the idea touches
  4. project-navigator loads projects-current.md — flags any sprint or dependency conflicts
  5. strategy-advisor loads business-model.md — checks alignment with Phase 1/2 strategy
  6. memory-curator scans memory/index.md — surfaces any prior sessions touching this idea
  7. lead-brain delivers Orientation Package to lead-brainstorm:
       - Ecosystem context (which entity, which cascade position if applicable)
       - Prior session knowledge (top 3 related records if any)
       - Strategic constraints (what the business model allows/disallows)
       - Philosophical ground (which of the six cores is most relevant here)
       - Sovereignty flags (any known risks from this direction)

Output: Orientation Package
---

### PHASE 2 — EXPLORE (Brainstorm team, Brain available)

  1. lead-brainstorm presents: user idea + Orientation Package to the brainstorm team
  2. concept-explorer maps the idea from every angle:
       - Business potential (what market does this address?)
       - Philosophical alignment (which of the six cores does this engage?)
       - User need (who experiences the pain this solves?)
       - Financial viability signal (at a high level — not deep analysis)
       - Cultural / ethical dimension (what community or living system is affected?)
       - Technical touchpoints (which entities or products does this touch? high level only)
       - Analogues (where has something like this been tried before — successfully or not?)
  3. Brain team agents available throughout to answer constraint questions in real-time
       - ecosystem-architect: "does this fit the cascade?"
       - strategy-advisor: "is this aligned with the sovereign vision?"
       - memory-curator: "have we explored anything adjacent before?"

Output: Exploration Map (bullet list per angle — concept-explorer produces this)
---

### PHASE 3 — CHALLENGE (idea-challenger fires Proactive Signal Protocol)

This is a session gate. Synthesis cannot begin until PHASE 3 is complete.

  1. idea-challenger reads the Exploration Map
  2. idea-challenger checks all 7 Proactive Signals (see proactive-signal-protocol.md):
       Signal 1 — NOT RECOMMENDED
       Signal 2 — FINANCIALLY UNSOUND
       Signal 3 — ALREADY EXISTS
       Signal 4 — MARKET OVERSATURATED
       Signal 5 — UNSEEN OPPORTUNITY
       Signal 6 — VISION CONFLICT
       Signal 7 — PRIOR SESSION CONFLICT
  3. strategy-advisor (Brain) adds Vision Conflict signals from philosophical / sovereignty angle
  4. memory-curator (Brain) adds Prior Session Conflict signals from memory records
  5. All signals raised are logged with:
       - Signal type
       - One-sentence summary
       - Detail (2-3 sentences)
       - Direction (what to do instead or additionally)
       - Owner (which agent surfaced it)

If zero signals fire: idea-challenger states "No signals raised — idea passes challenge."
If signals fire: they are presented to lead-brainstorm. lead-brainstorm decides whether to:
  - Continue (signals are informational)
  - Return to Phase 2 to refine the idea
  - Present signals to user immediately (if a signal is a hard blocker)

Output: Signal Report (all signals logged with status: OPEN / ADDRESSED / ACCEPTED / WAIVED)
---

### PHASE 4 — SYNTHESIZE (synthesis-builder, Brain available)

  1. synthesis-builder reads: Exploration Map + Signal Report + Orientation Package
  2. synthesis-builder produces exactly 2-3 structured option directions:
       Option A: [name + one-sentence description]
         - Strongest argument for it
         - Strongest argument against it
         - Routing recommendation (business / marketing / brain update / tech-brainstorm / combination)
       Option B: [same structure]
       Option C: [same structure, if applicable]
  3. synthesis-builder proposes a recommended option with rationale
  4. strategy-advisor (Brain) confirms each option against:
       - Sovereignty principle
       - Phase 1/2 business model alignment
       - Corruption test
  5. lead-brain co-signs: "Ecosystem and philosophy check complete — options A/B/C are [CLEAR / FLAG: detail]"

Output: Options Set (2-3 structured directions + Brain co-sign)
---

### PHASE 5 — PRESENT (lead-brainstorm → user)

  1. lead-brainstorm presents:
       - Summary of what was explored (Exploration Map in brief)
       - Signals raised and their status
       - 2-3 options with trade-offs
       - Recommended option + Brain co-sign
  2. lead-brainstorm asks the user:
       a. Which option do you want to pursue?
       b. Do you want to refine further before deciding?
       c. Do you want to waive any signals?

---

### PHASE 6 — DECIDE (user)

User chooses one of:
  a. Select an option → proceed to Phase 7
  b. Request iteration → return to Phase 2 with new direction
  c. Waive a signal → log it as WAIVED and continue

If the user selects a tech route ("this should become a feature in agenthub / optimaeus / anamnesis"):
  → Route to PHASE 7 with routing = TECH-BRAINSTORM
---

### PHASE 7 — CLOSE (lead-brainstorm produces Idea Brief)

  1. lead-brainstorm fills out the Idea Brief template (brainstorm/ops/idea-brief-template.md):
       - Idea definition
       - Exploration summary
       - All signals raised + final status
       - Chosen option
       - Routing decision
       - Brain alignment stamp
  2. lead-brainstorm presents Idea Brief to user for final approval

---

### PHASE 8 — ROUTE (routing decision implemented)

  BUSINESS RESEARCH:  lead-brainstorm hands Idea Brief to lead-business for research session
  MARKETING:          lead-brainstorm hands Idea Brief to lead-marketing
  BRAIN UPDATE:       lead-brain updates relevant knowledge file (projects-current / business-model / philosophy)
  TECH-BRAINSTORM:    lead-brainstorm saves Idea Brief to memory → opens tech-brainstorm session
  COMBINATION:        lead-brainstorm coordinates parallel routing (e.g., business + tech-brainstorm)

---

### PHASE 9 — DEPOSIT (data team)

  1. lead-brainstorm notifies lead-data: "Idea Brief [IDEA-ID] approved — please deposit"
  2. data-architect creates IDEA record in memory/records/brainstorm/
  3. data-architect adds row to memory/index.md
  4. If this is the 5th deposit since last pattern check → pattern check triggered

---

## SESSION FAILURE STATES

  User not satisfied with any option → return to Phase 2. Explore from a different angle.
  Signal is a hard blocker (sovereignty violation) → present to user before proceeding.
  Idea is too large (spans 3+ domains) → decompose: brainstorm one sub-idea at a time.
  No prior knowledge in memory + no ecosystem fit → note explicitly in Idea Brief. First time.

---

## WHO READS WHAT

  lead-brainstorm:    this file + idea-brief-template.md
  concept-explorer:   Orientation Package from lead-brain
  idea-challenger:    proactive-signal-protocol.md + Exploration Map
  synthesis-builder:  Exploration Map + Signal Report + Orientation Package
  lead-brain:         philosophy.md (ALWAYS) + manifest.md
  ecosystem-architect: ecosystem.md
  project-navigator:  projects-current.md
  strategy-advisor:   business-model.md + philosophy.md
  memory-curator:     memory/README.md + memory/index.md (up to 3 records)
