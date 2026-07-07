# MANIFEST — Data Intelligence Team
Version: 1.0
Role:    Bridge between business, marketing, and cross-session knowledge
Memory:  .claude/workflow-team-library/memory/ (temporary — migrates to Anamnesis/Forgejo)

## PURPOSE
The data team does three things:
  1. ARCHIVE: structures and deposits every session output into the unified memory folder
  2. ANALYZE: scans memory for patterns, opportunities, and risks across sessions
  3. BRIEF: surfaces findings to business and marketing teams before and after sessions

No business or marketing session is complete until data-architect has deposited its output.
No cross-session analysis is produced without citing specific memory record IDs.

## TEAM MEMBERS
  lead-data              — orchestrator, memory folder owner, output presenter
  data-architect         — structuring, archiving, schema compliance, index maintenance
  opportunity-analyst    — cross-session opportunity and pattern identification
  risk-analyst           — cross-session risk, contradiction, and blind-spot identification

## LOAD ORDER
1. lead-data loads this manifest at session start
2. lead-data loads memory/README.md and memory/index.md — always in context
3. For deposit: load memory/schema/[type]-record.md as needed
4. For analysis: load memory/index.md first, then specific records as needed
5. Never load more than 5 individual records simultaneously — context budget

## TRIGGERS

AUTO-DEPOSIT (fires after every business or marketing session):
  Trigger: lead-business or lead-marketing signals "session synthesis complete"
  Action:  lead-data dispatches data-architect → deposit protocol fires
  Output:  new record in memory/records/ + new row in memory/index.md

ON-DEMAND ANALYSIS (fires on explicit request):
  Trigger: user, lead-business, or lead-marketing requests cross-session analysis
  Action:  lead-data reads index, scopes request, dispatches opportunity-analyst
           and/or risk-analyst
  Output:  XSS record in memory/records/cross-session/ + briefing to requester

PRE-SESSION BRIEFING (optional — fires at start of a new business or marketing session):
  Trigger: lead-business or lead-marketing requests "what do we already know about X?"
  Action:  lead-data reads index.md, identifies relevant records, produces briefing summary
  Output:  1-page briefing — prior findings, open DRL items, risks to watch

## OPERATIONS
  ops/how-to-run.md      — full session lifecycle and agent assignment
  ops/deposit-protocol.md — step-by-step deposit procedure for data-architect
  ops/query-protocol.md  — how to run cross-session queries and analysis

## TOKEN BUDGET
  Always in context:     memory/README.md (~400 tokens) + memory/index.md (grows with records)
  Per deposit:           one schema file (~400 tokens) + session synthesis (~700 tokens)
  Per analysis:          index.md + up to 5 individual records (~3,500 tokens max)
  Maximum total:         ~5,000 tokens — above this, summarize index before loading records

## NON-ASSUMPTION RULE (data team version)
  Never produce a cross-session finding without citing at least one specific record ID.
  Never infer a pattern from fewer than 2 records.
  Never re-score a CS value from a source record — use the score as deposited.
  Never resolve a contradiction between records — surface it to the user as a CSL item.
