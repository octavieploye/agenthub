# SCHEMA: Marketing Session Record
TYPE:   memory/schema — used by data-architect when depositing a marketing session
TOKENS: ~400

## PURPOSE
Standardized format for archiving a completed marketing session.
data-architect creates one file per session using this schema.
File is saved to: memory/records/marketing/[ID].md

## RECORD FORMAT

```markdown
---
id:          MKT-[YYYY-MM-DD]-[project-slug]-[layer-code]
type:        marketing
date:        [ISO 8601 — session close date]
project:     [project name]
layer:       [M6 for full forward / R5 for full reverse / specific code if partial]
mode:        [FORWARD / REVERSE / LOOP]
geo-tracks:  [active tracks]
lrs:         [Launch Readiness Score: N/100 — or N/A if M2 not run]
cs-range:    [min–max CS across findings]
open-drl:    [count of open DRL items at session close]
open-csl:    [count of open CSL items at session close]
deposited:   [date deposited to memory]
linked-biz:  [ID of the business record this session draws from, if any]
---

## SESSION SUMMARY

Project: [name]
Mode: [FORWARD / REVERSE / LOOP]
Active geos: [list]
Session goal: [build campaign strategy / audit existing campaign / specific task]

## PERSONA SUMMARY (if M1 or R4 was completed)

Buyer archetype:     [name]
Gender:              [value or UNKNOWN]
Age range:           [value]
Family status:       [value or UNKNOWN]
Primary platform:    [channel]
Communication pref:  [phone / text / video / podcast / mixed]
Pain (exact quote):  "[buyer language]"
Top trigger event:   [event]

## MARKET READINESS (if M2 was completed)

LRS: [N]/100
Recommendation: [LAUNCH NOW / PRE-LAUNCH BUILD / WAIT / DO NOT LAUNCH]
Top risk: [macro force or friction]
Pre-launch required: [YES / NO]

## COMPETITIVE MARKETING SUMMARY (if M3 was completed)

Players audited: [count]
Primary channel gap: [where competitors are absent that our persona is active]
Competitor top claim: "[their H1]"
Our differentiation: [what we own that they don't]

## CHANNEL STRATEGY SUMMARY (if M4 was completed)

Primary channels:    [list]
Media mix:           [owned % / earned % / paid %]
Paid spend trigger:  [CVR threshold]

## CORE MESSAGE (if M5 was completed)

H1: "[text]"
H2: "[text]"
CTA: "[text]"
Proof type: [type]

## CAMPAIGN PLAN SUMMARY (if M6 was completed)

Phase 0: [goal + channel] — required: [YES/NO]
Phase 1: [goal + channel + metric + timeline]
Phase 2: [goal + channel + metric + timeline]

## OPEN ITEMS AT SESSION CLOSE

DRL items open:   [count] — [description]
CSL items open:   [count] — [description]
Watchlist items:  [count] — [top watchlist signal]

## SIGNALS FOR CROSS-SESSION ANALYSIS

[Persona attributes that were DRL-waived — may have evidence in other sessions]
[Channel performance patterns that may confirm or contradict other projects]
[Message elements with CS < 60 — flag for cross-project validation]
[Competitor moves that may affect other projects in the portfolio]

## RAW SESSION OUTPUT REFERENCE

---
[FULL SESSION OUTPUT — paste L6 synthesis + all layer outputs below this line]
---
```

## DATA-ARCHITECT INSTRUCTIONS

1. Request the L6 synthesis from lead-marketing
2. Request all layer-level outputs (M1-M6 or R1-R5 summaries)
3. Complete the structured summary above
4. Link to the associated business record if one exists (linked-biz field)
5. Paste full L6 synthesis in the RAW SESSION OUTPUT section
6. Save file as: memory/records/marketing/[ID].md
7. Append one row to memory/index.md
8. Check waived DRL tracker — add any newly waived persona or market items
9. Report deposit complete to lead-data
