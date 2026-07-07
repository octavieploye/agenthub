# MODULE: data/ops/query-protocol
TYPE:   Operations — guide for running cross-session queries and analysis
OWNER:  lead-data (dispatches to opportunity-analyst and risk-analyst)
TOKENS: ~450

## PURPOSE
Defines how to run a cross-session analysis request — from scoping to output.
Used when user, lead-business, or lead-marketing submits an analysis request.

## QUERY TYPES

  TYPE 1 — OPPORTUNITY SCAN
    "What opportunities have we seen that we have not acted on?"
    "Is there a channel or persona pattern across our projects?"
    "Where are we consistently finding white space?"
    Dispatched to: opportunity-analyst
    Output type: XSS record with finding-type: OPPORTUNITY or PATTERN

  TYPE 2 — RISK SCAN
    "What risks are we not taking seriously enough?"
    "Are there contradictions between our sessions?"
    "What DRL items have we been waiving that we shouldn't?"
    Dispatched to: risk-analyst
    Output type: XSS record with finding-type: RISK, CONTRADICTION, or BLIND-SPOT

  TYPE 3 — TOPIC DEEP-DIVE
    "What do we know about [specific topic]?" (persona, vertical, geo, competitor)
    Dispatched to: both analysts or just the relevant one
    Output type: XSS record or pre-session briefing (if no formal deposit needed)

  TYPE 4 — PRE-SESSION BRIEFING
    "Before we start the [project] business session, what have we seen before?"
    Dispatched to: lead-data (reads index directly, no full analysis record needed)
    Output type: 1-page briefing (informal — not deposited as XSS record)

## STEP-BY-STEP QUERY PROCEDURE

### STEP 1 — SCOPE THE REQUEST
  lead-data reads the request and determines:
    Query type: [1 / 2 / 3 / 4]
    Relevant record types: [BUS / MKT / XSS / all]
    Relevant projects: [specific / all]
    Date range: [specific / last N sessions / all time]
    Key term: [what concept, vertical, geo, or competitor to look for]

### STEP 2 — SCAN THE INDEX
  lead-data reads memory/index.md.
  Filter to relevant rows by: Type, Project, Geo, Key Finding keywords.
  Identify up to 10 candidate record IDs.
  Rank by relevance (most recent + most directly relevant first).
  Share scoped list with the analyst being dispatched.

### STEP 3 — DISPATCH ANALYST
  Provide analyst with:
    - The original request (exact wording)
    - The scoped record list (IDs only — analyst loads files)
    - The query type (opportunity / risk / topic / briefing)
    - Any specific angle to focus on

### STEP 4 — ANALYST READS RECORDS

  opportunity-analyst protocol:
    1. Load records in relevance order (max 5 simultaneously)
    2. For each record: extract key finding, CS, open items, signals for cross-session
    3. Look for: repeated patterns, consistent white space, timing windows appearing across sessions
    4. Minimum for PATTERN finding: 3 records showing same direction
    5. Minimum for OPPORTUNITY finding: 2 records with converging evidence
    6. Document each finding with: claim → supporting record IDs → CS → action flag

  risk-analyst protocol:
    1. Load records — prioritize those with open-drl > 0
    2. Also load the waived DRL tracker from memory/index.md
    3. Look for: decaying signals (findings losing CS over time), contradictions (two records
       making opposing claims), blind spots (topic waived 2+ times), assumption drift
       (same assumption made in multiple sessions without ever being verified)
    4. Minimum for CONTRADICTION: 2 records making directly opposing claims
    5. Minimum for BLIND-SPOT: topic waived or absent in 3+ records
    6. Document each finding with: claim → supporting record IDs → CS → action flag

### STEP 5 — ANALYST PRODUCES OUTPUT
  Analyst produces report using cross-session-record.md schema structure.
  Every finding cites specific record IDs.
  Every claim has a CS score (weighted average of source records).
  Sections completed: Summary, Core Finding, Supporting Evidence, What Is Not Supported,
  Implications, Recommended Action.

### STEP 6 — DEPOSIT AND PRESENT
  Analyst returns report to lead-data.
  lead-data dispatches data-architect to deposit as XSS record.
  lead-data presents findings to requester with:
    - Core finding (1-2 sentences)
    - Action flag (IMMEDIATE / WATCH / INFORM / ARCHIVE)
    - Recommended next step
    - Full XSS record ID for reference

## QUERY CONSTRAINTS

  Never load more than 5 records simultaneously — context budget.
  If more than 5 records are relevant: summarize the first 5, then load the next batch.
  Never produce a finding that spans fewer records than its minimum threshold.
  Never guess what a record contains — load it and read it.
  Never produce a finding without an action flag — every finding has a disposition.

## OUTPUT ACTION FLAGS

  IMMEDIATE — present to user and team lead now, before any next session
  WATCH     — add to watchlist, surface at next relevant session briefing
  INFORM    — include in next pre-session briefing for the relevant team
  ARCHIVE   — noted in memory, no active follow-up required
