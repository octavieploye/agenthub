# Memory Schema: Tech-Brainstorm Record (FEAT)
OWNER:  data-architect
TYPE:   FEAT
USE:    Deposited after every approved Feature Brief from a tech-brainstorm session.
        Enables cross-session analysis: what features have been specced, what technical
        decisions have been made, what cascade placements have been confirmed.

---

## FRONTMATTER

```
---
id:           FEAT-YYYY-MM-DD-[product]-[slug]
date:         YYYY-MM-DD
type:         FEAT
product:      [agenthub | optimaeus-head | anamnesis | llm-workflows-pckg]
entity:       [hephaestus | optimaeus | anamnesis | logos | hermes | demiurge | cross-entity]
source-idea:  [IDEA-YYYY-MM-DD-slug] (the Idea Brief this came from)
status:       [approved | in-sprint | built | superseded | cancelled]
brain-cosign: [clear | conditional | hold]
option-chosen: [A | B | C]
ux-chosen:    [1 | 2 | 3]
sprint-size:  [XS | S | M | L | XL | decomposed]
file:         memory/records/tech-brainstorm/FEAT-YYYY-MM-DD-[product]-[slug].md
---
```

---

## STRUCTURED SUMMARY

### Feature
**Name:** [Feature name]
**Core intent:** [One sentence — the problem this solves]
**Product:** [Which product]
**Source Idea Brief:** [IDEA-ID]

### Cascade Placement
**Entity:** [Which entity owns this]
**DB impact:** [New tables? Schema changes? Or "none"]
**Cross-entity impact:** [Yes: detail | No]
**New API contracts:** [List, or "none"]

### Chosen Direction
**Technical option:** [A / B / C — name]
**UX direction:** [1 / 2 / 3 — name]
**Rationale:** [2 sentences max]

### Risk Summary
**Top risk:** [Highest-impact risk from register]
**DB migration risk:** [None | Low | Medium | High]
**Breaking change:** [Yes: scope | No]
**Sovereignty:** [Compliant | Conditional | Breach]

### Open Items
**Pre-requisites outstanding:** [List, or "none"]
**Brain knowledge updates triggered:** [e.g., "projects-current.md: agenthub sprint R8 added"]
**Cross-session signals:**
  - [Any signal worth tracking — e.g., "Second feature touching Anamnesis write layer"]

---

## RAW FEATURE BRIEF

[Full Feature Brief content pasted here verbatim — all 8 sections]

---

## DEPOSIT LOG

**Deposited by:**      data-architect
**Deposited on:**      YYYY-MM-DD
**Session type:**      tech-brainstorm
**Brain co-chair:**    lead-brain
**Dev-stack validators:** architect, dev-backend
**Post-deposit check:** [Pattern check triggered if 5th deposit since last check — YES | NO]
