# MODULE: data/ops/how-to-run
TYPE:   Operations — read by lead-data at session start
OWNER:  lead-data
TOKENS: ~550

## SESSION LIFECYCLE

### AUTO-DEPOSIT SESSION (fires after every business or marketing session close)

  Trigger received:   lead-business or lead-marketing signals session synthesis complete
  lead-data action:   confirm which session type (business or marketing)
  Dispatch:           data-architect

  data-architect steps:
    1. Request the closed synthesis output from the originating team lead
    2. Request all layer summaries for the session
    3. Load memory/schema/[type]-record.md for the correct record type
    4. Complete the structured summary section of the schema
    5. Append the full synthesis to the RAW SESSION OUTPUT section
    6. Generate record ID: [BUS/MKT]-[YYYY-MM-DD]-[project-slug]-[layer]
    7. Save file to memory/records/[type]/[ID].md
    8. Append new row to memory/index.md
    9. Check memory/index.md waived DRL tracker — add any newly waived items
   10. Report to lead-data: "Deposit complete — [ID]"

  lead-data action:   confirm deposit to originating team lead. Session is now closed.

  Timeline: deposit should complete within the same session. Never carry over to next session.

---

### ON-DEMAND ANALYSIS SESSION

  Trigger received:   user, lead-business, or lead-marketing sends analysis request
  Example requests:
    "What do we know about buyer personas in the [vertical] space?"
    "Are there patterns in our competitive positioning across projects?"
    "What risks have we been ignoring or waiving?"
    "Find opportunities we have not acted on yet"

  lead-data steps:
    1. Load memory/index.md
    2. Scope the request: which record types (BUS/MKT/XSS), which date range, which projects
    3. Identify relevant record IDs from index.md
    4. Decide: opportunity-analyst / risk-analyst / both
    5. Dispatch with scoped record list (do not give all records — give the relevant subset)
    6. Receive analysis output from analyst(s)
    7. Dispatch data-architect to deposit the XSS record
    8. Present findings to requester

  opportunity-analyst steps:
    1. Read memory/index.md (already in context from lead-data)
    2. Load individual records in order of relevance (max 5 at once)
    3. Identify opportunities, patterns — cite every claim with record ID
    4. Produce cross-session opportunity report using schema/cross-session-record.md structure
    5. Return to lead-data

  risk-analyst steps:
    1. Read memory/index.md
    2. Load individual records — prioritize records with open-drl > 0 or open-csl > 0
    3. Also read waived DRL tracker in index.md
    4. Identify risks, contradictions, blind spots — cite every claim with record ID
    5. Produce cross-session risk report
    6. Return to lead-data

---

### PRE-SESSION BRIEFING (optional)

  Trigger: lead-business or lead-marketing asks "what do we already know about [topic]?"
  lead-data steps:
    1. Load memory/index.md
    2. Scan for records matching the topic (project slug, geo, key finding keywords)
    3. Load the top 3 most relevant records
    4. Produce 1-page briefing: prior findings → open items → risks to watch
    5. Present briefing to requesting team lead before their session begins

  This briefing is context for the incoming session — not instructions.
  The business or marketing team makes their own judgments from the briefing.

---

## WHO READS WHAT

  lead-data:
    ALWAYS in context:  data/manifest.md + memory/README.md + memory/index.md
    LOAD per deposit:   memory/schema/[type]-record.md
    LOAD per analysis:  up to 5 individual records from memory/records/

  data-architect:
    LOAD per deposit:   memory/schema/[type]-record.md (correct type for the session)
    REFERENCE:          memory/index.md (to check record ID sequence and waived DRL tracker)
    NEVER loads:        analysis records or past records — scope is current deposit only

  opportunity-analyst:
    ALWAYS start with:  memory/index.md (read before loading any individual record)
    LOAD per analysis:  specific records identified by lead-data (max 5 simultaneously)
    REFERENCE:          memory/index.md pattern log
    NEVER loads:        schemas — reading only

  risk-analyst:
    ALWAYS start with:  memory/index.md + waived DRL tracker section
    LOAD per analysis:  records with open items first, then by relevance
    NEVER loads:        schemas — reading only

---

## FAILURE STATES

  No session output received for deposit:
    lead-data follows up with lead-business or lead-marketing.
    Session cannot be marked closed in memory until deposit is complete.

  Index.md becomes too large to load in context:
    data-architect creates a quarterly archive: memory/index-archive-[YYYY-Q].md
    Active index.md retains only last 12 months of records.
    Old records remain fully accessible in memory/records/ — only removed from index.

  Record contradiction found during analysis:
    risk-analyst produces a CONTRADICTION type XSS record.
    lead-data surfaces to user as a CSL item.
    User resolves. Outcome noted in the XSS record.

  Analysis requested but fewer than 2 records exist:
    lead-data informs requester: insufficient records for cross-session analysis.
    No analysis produced — wait until at least 2 sessions are deposited.
    Exception: PRE-SESSION BRIEFING can run from 1 record.
