# SCHEMA: Business Session Record
TYPE:   memory/schema — used by data-architect when depositing a business session
TOKENS: ~400

## PURPOSE
Standardized format for archiving a completed business research session.
data-architect creates one file per session using this schema.
File is saved to: memory/records/business/[ID].md

## RECORD FORMAT

```markdown
---
id:          BUS-[YYYY-MM-DD]-[project-slug]-[layer-code]
type:        business
date:        [ISO 8601 — session close date]
project:     [project name]
layer:       [L6 for full session / specific layer code if partial]
mode:        [FORWARD / REVERSE / LOOP]
geo-tracks:  [active tracks: FR / EU / US / CN / Asia / Africa / Oceania]
cs-range:    [min–max CS across all findings, e.g., 45–82]
open-drl:    [count of open DRL items at session close]
open-csl:    [count of open CSL items at session close]
deposited:   [date deposited to memory — may differ from session date]
---

## SESSION SUMMARY

Project: [name]
Niche/vertical: [description]
Mode: [FORWARD / REVERSE / LOOP]
Active geos: [list]
Session goal: [what was the research question or task]

## KEY FINDINGS (top 5, sourced)

1. [Finding] — Layer: [L1-L5/R1-R5] — CS: [score] — Source: [tier + source name]
2. [Finding] — Layer: [X] — CS: [score] — Source: [X]
3. [Finding] — Layer: [X] — CS: [score] — Source: [X]
4. [Finding] — Layer: [X] — CS: [score] — Source: [X]
5. [Finding] — Layer: [X] — CS: [score] — Source: [X]

## ICP PROFILE SUMMARY (if F5/R1 was completed)

Buyer archetype:    [one sentence]
Trigger events:     [list]
Failure language:   [exact quote(s)]
Trust signals:      [list]
Top objections:     [list]

## COMPETITIVE SUMMARY (if F4/R2 was completed)

Players identified: [count]
Gap matrix:         [top white space — one sentence]
Customer voice:     [top positive + top negative pattern]

## MACRO FORCES (if F1/R5 was completed)

Top force:   [name] — TTA: [tag] — CS: [score]
Second:      [name] — TTA: [tag] — CS: [score]
Third:       [name] — TTA: [tag] — CS: [score]

## OPEN ITEMS AT SESSION CLOSE

DRL items open:   [count] — [brief description of what is missing]
CSL items open:   [count] — [brief description of conflicts]
Watchlist items:  [count] — [top watchlist signal]

## SIGNALS FOR CROSS-SESSION ANALYSIS

[Any finding that should be compared against other projects or sessions]
[Any assumption that was flagged but not resolved]
[Any geo-specific signal that may have cross-market implications]

## RAW SESSION OUTPUT REFERENCE

Full layer outputs: [attached below or linked if separate file]
Source registry: [reference to session signal-registry.md if maintained]

---
[FULL SESSION OUTPUT — paste L6 synthesis + all layer outputs below this line]
---
```

## DATA-ARCHITECT INSTRUCTIONS

1. Request the L6 synthesis output from lead-business
2. Request all layer-level outputs (F1-F5 or R1-R5 summaries) from lead-business
3. Complete the structured summary above from those outputs
4. Paste the full L6 synthesis in the RAW SESSION OUTPUT section
5. Save file as: memory/records/business/[ID].md
6. Append one row to memory/index.md
7. Check memory/index.md waived DRL tracker — add any newly waived items
8. Report deposit complete to lead-data
