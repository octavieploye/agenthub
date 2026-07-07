# Memory Schema: Brainstorm Record (IDEA)
OWNER:  data-architect
TYPE:   IDEA
USE:    Deposited after every approved Idea Brief from a general brainstorm session.
        Enables cross-session analysis: what ideas have been explored, what signals fired,
        what directions were chosen, what patterns emerge across idea sessions.

---

## FRONTMATTER

```
---
id:           IDEA-YYYY-MM-DD-[slug]
date:         YYYY-MM-DD
type:         IDEA
domain:       [business | marketing | financial | philosophical | product | cross-domain]
routing:      [business | marketing | brain-update | tech-brainstorm | combination]
status:       [approved | routed | archived | superseded]
brain-cosign: [clear | conditional | hold]
signals-fired: [comma-separated signal types, or "none"]
file:         memory/records/brainstorm/IDEA-YYYY-MM-DD-[slug].md
---
```

---

## STRUCTURED SUMMARY

### The Idea
**Name:** [Idea name]
**Core intent:** [One sentence — the problem or opportunity behind the idea]
**Domain:** [Which domain: business / marketing / financial / philosophical / product / cross-domain]

### Signals Raised
**Signals fired:** [List of signal types, or "none"]
**Waived signals:** [List of waived signal types, or "none"]
**Key concern surfaced:** [Most important signal raised, in one sentence]

### Direction Chosen
**Option selected:** [A / B / C — name]
**Routing:** [Which team received the Idea Brief next]
**Brain co-sign:** [Clear | Conditional | Hold]

### Open Items
**Unresolved signals:** [List, or "none"]
**Prior session links:** [Related IDEA/BUS/MKT record IDs, or "none"]
**Cross-session signals:**
  - [Any pattern worth flagging — e.g., "Third idea touching sovereignty boundary"]

---

## RAW IDEA BRIEF

[Full Idea Brief content pasted here verbatim — all sections]

---

## DEPOSIT LOG

**Deposited by:**      data-architect
**Deposited on:**      YYYY-MM-DD
**Session type:**      brainstorm (general)
**Brain co-chair:**    lead-brain
**Post-deposit check:** [Pattern check triggered if 5th deposit since last check — YES | NO]
