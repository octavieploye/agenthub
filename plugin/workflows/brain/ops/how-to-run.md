# MODULE: brain/ops/how-to-run
TYPE:   Operations — read by lead-brain at session start
OWNER:  lead-brain
TOKENS: ~500

## WHEN TO ACTIVATE THE BRAIN TEAM

The brain team is a meta-layer. Activate it:

  BEFORE a session: pre-session orientation and briefing
  DURING a session: when a cross-project or strategic question surfaces
  AFTER a session: when the session produces a decision that changes project status

Do NOT activate for single-team, single-project work that has no ecosystem implications.
The brain does not attend every meeting — it orients, then steps back.

---

## SESSION TYPES AND WHO RUNS

### SESSION TYPE 1 — PRE-SESSION BRIEFING
Trigger: Any team is about to start a session on a known project.
Goal: Surface what is already known before the team starts blind.

  1. User or team lead requests: "brain, brief us on [project/topic] before we start"
  2. lead-brain loads manifest.md
  3. lead-brain dispatches memory-curator to scan memory/index.md for prior records
  4. lead-brain dispatches project-navigator to confirm current project status
  5. lead-brain produces 1-page briefing:
     - What exists (built, in progress, planned)
     - What we already know from prior sessions (top 3 memory records)
     - Open questions and architectural constraints
     - What the team should NOT assume
  6. Briefing delivered. Brain team steps back. The work session proceeds.

---

### SESSION TYPE 2 — ECOSYSTEM ARCHITECTURE QUESTION
Trigger: "Where should X live?", "How does Y connect to Z?", "What breaks if we change W?"
Goal: Accurate architectural answer with source citation.

  1. lead-brain receives the question
  2. lead-brain dispatches ecosystem-architect
  3. ecosystem-architect loads knowledge/ecosystem.md
  4. ecosystem-architect reads relevant entity definitions from optimaeus-architecture/ if needed
  5. ecosystem-architect produces: answer + rationale + which files confirm it
  6. lead-brain presents answer to user with source citations
  7. If the answer changes a prior architectural decision → note as a decision for the user to confirm

---

### SESSION TYPE 3 — PROJECT STATUS CHECK
Trigger: "Where are we?", "What's the status of everything?", "What should we build next?"
Goal: Current-state snapshot across all projects.

  1. lead-brain dispatches project-navigator
  2. project-navigator loads knowledge/projects-current.md
  3. project-navigator produces: status snapshot (what is built / in sprint / planned / blocked)
  4. If the user asks "what next?": strategy-advisor runs in parallel
  5. strategy-advisor loads knowledge/business-model.md
  6. strategy-advisor produces: sequencing recommendation based on current status + business model
  7. lead-brain presents combined output

---

### SESSION TYPE 4 — STRATEGIC QUESTION
Trigger: "Is this the right direction for Opeidos?", "Should we build X or Y first?",
         "What is our competitive position?", "Is this aligned with the sovereign vision?"
Goal: Strategic recommendation grounded in known context, not opinion.

  1. lead-brain dispatches strategy-advisor
  2. strategy-advisor loads knowledge/business-model.md + knowledge/projects-current.md
  3. strategy-advisor also requests memory-curator to check for relevant prior decisions
  4. strategy-advisor produces: 2-option recommendation with tradeoffs + recommendation
  5. All strategic decisions require explicit user approval — strategy-advisor proposes, user decides

---

### SESSION TYPE 5 — POST-SESSION KNOWLEDGE UPDATE
Trigger: A session produced a major decision, status change, or architectural choice.
Goal: Keep the knowledge base current.

  1. User or team lead signals: "update brain on [what changed]"
  2. lead-brain identifies which knowledge file needs updating:
     - Architecture change → knowledge/ecosystem.md
     - Project status change → knowledge/projects-current.md
     - Business model change → knowledge/business-model.md
  3. lead-brain drafts the update and presents it to the user for confirmation
  4. User approves → knowledge file is updated
  5. If the update also affects memory/index.md (e.g., new session completed) → lead-data is notified

---

## WHO READS WHAT

  lead-brain:
    ALWAYS: brain/manifest.md
    PER SESSION: knowledge/[relevant].md (not all three unless needed)

  ecosystem-architect:
    LOAD: knowledge/ecosystem.md
    REFERENCE: optimaeus-architecture/ entity files when specific technical detail is needed
    NEVER: memory folder (that is memory-curator's domain)

  project-navigator:
    LOAD: knowledge/projects-current.md
    REFERENCE: specific project docs when status detail is needed
    UPDATE: knowledge/projects-current.md after user confirms status change

  strategy-advisor:
    LOAD: knowledge/business-model.md + knowledge/projects-current.md
    REFERENCE: business team or marketing team memory records (via memory-curator)
    UPDATE: knowledge/business-model.md after user confirms strategic decision

  memory-curator:
    ALWAYS START: memory/README.md + memory/index.md
    LOAD: specific records only when relevant to the current question (max 3 at once)
    NEVER: knowledge/ files — those are the brain team's domain, not memory's

---

## KNOWLEDGE FILE MAINTENANCE

  After any of these events — update the relevant knowledge file:
    Major sprint completed → projects-current.md
    New entity created → ecosystem.md
    Architectural decision made → ecosystem.md
    Business model change → business-model.md
    New project added → projects-current.md
    Opeidos/marketplace update → business-model.md

  Rule: If it is still true, leave it. If it has changed, update it and note the date.
  Never delete history — add a note: "[superseded — new state: X]"

---

## WHAT THE BRAIN TEAM NEVER DOES

  Never writes code or modifies source files
  Never runs git commands
  Never makes final decisions (user is always the decision-maker)
  Never briefs external parties (all briefings are for the user and internal teams)
  Never stores new information without user confirmation of accuracy
