# UNIFIED MEMORY FOLDER
Version: 1.0
Status:  TEMPORARY — will migrate to Anamnesis (neuronal memory layer) or Forgejo
         (business standalone wiki) when those systems are ready.
Owner:   data team (lead-data + data-architect)

---

## PURPOSE

This folder is the shared knowledge base for the business, marketing, and data teams.
It stores all session outputs so that:
- The data team can draw cross-session analysis
- Future sessions can reference prior findings without starting from zero
- Opportunity-analyst and risk-analyst can identify patterns invisible within a single session
- Senior analysts have a queryable corpus of prior work

---

## WHAT IS STORED HERE

  records/business/     — full archives + structured summaries of every business research session
  records/marketing/    — full archives + structured summaries of every marketing session
  records/cross-session/ — data team analysis outputs (opportunities, risks, pattern reports)

  index.md              — master index: one row per session, queryable at a glance
  schema/               — standard record formats for all three types

---

## WHO WRITES HERE

  WRITES:               data-architect (data team) — the only agent who writes to this folder
  READS:                any agent, any team — memory is read-only for all non-data agents
  DEPOSITS to:          data-architect receives a session output and creates the record
  REQUESTS from:        lead-data receives analysis request, dispatches opportunity-analyst
                        or risk-analyst to read and produce cross-session analysis

  Rule: business and marketing teams do NOT write directly to this folder.
  They produce their synthesis output, hand it to data-architect, who structures and archives it.

---

## RECORD ID SYSTEM

  Business records:      BUS-[YYYY-MM-DD]-[project-slug]-[layer-code]
  Marketing records:     MKT-[YYYY-MM-DD]-[project-slug]-[layer-code]
  Cross-session records: XSS-[YYYY-MM-DD]-[analyst-id]-[topic-slug]

  Examples:
    BUS-2026-06-24-fintech-saas-L6   — business session L6 synthesis, fintech SaaS project
    MKT-2026-06-24-fintech-saas-M6   — marketing M6 campaign plan, same project
    XSS-2026-06-28-opp-analyst-payment-gap — opportunity-analyst cross-session report

---

## AUTO-DEPOSIT TRIGGER

After every business or marketing session synthesis closes (L6 / marketing L6):
  1. lead-data receives the closed synthesis from lead-business or lead-marketing
  2. lead-data dispatches data-architect
  3. data-architect creates:
     a. Full raw archive → records/[type]/[ID].md
     b. Structured summary entry → appended to index.md
  4. lead-data confirms deposit complete to the originating team lead

This fires automatically. It is not optional.

---

## ON-DEMAND ANALYSIS TRIGGER

User or team lead sends explicit request: "analyze what we know about X"
  1. lead-data receives request
  2. lead-data reads index.md to scope relevant records
  3. lead-data dispatches opportunity-analyst and/or risk-analyst
  4. Analysts read index.md first, then specific records as needed
  5. Analysts produce cross-session report → deposited to records/cross-session/
  6. lead-data presents findings to requester

---

## MIGRATION PLAN

When Anamnesis is ready:
  Each record in records/ maps to an Anamnesis memory layer:
    records/business/  →  episodic memory (project-specific research events)
    records/marketing/ →  episodic memory (campaign events)
    records/cross-session/ →  pattern memory (learnings + skill candidates)

When Forgejo (business standalone) is ready:
  records/ can be committed as a wiki under optimaeus/[project-name]/wiki/
  index.md becomes the wiki index page

Schema is designed to be forward-compatible with both targets.

---

## IMPORTANT RULES

1. Never delete a record — mark it superseded if replaced
2. Never edit a record after it is deposited — add a new record with correction note
3. CS scores in records reflect the session that produced them — do not re-score
4. DRL/CSL items in records show status at session close — update only via new record
5. This folder is not a cache — it is the authoritative knowledge store until migration
