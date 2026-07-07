# Feature Brief Template
MODULE: tech-brainstorm/ops/feature-brief-template
OWNER:  lead-tech-brainstorm
USE:    Filled at Phase 7 (Synthesize). Presented to user at Phase 8 (Approve).
        Deposited by data-architect at Phase 9 as FEAT record.
        Handed to dev-stack lead for sprint planning after user approval.

---

## FEATURE BRIEF: [Feature Name]

**ID:**              FEAT-YYYY-MM-DD-[product]-[slug]
**Date:**            YYYY-MM-DD
**Product:**         [agenthub | optimaeus HEAD | anamnesis | llm-workflows-pckg]
**Source Idea Brief:** [IDEA-YYYY-MM-DD-slug] (link to approved brainstorm output)
**Status:**          [draft | approved | in-sprint | built | superseded]
**Brain co-sign:**   [CLEAR / CONDITIONAL: detail / HOLD: reason]

---

## 1. FEATURE DEFINITION

*(From Idea Brief Section 1 — do not re-write, reference or paste)*

**Core intent:**     [Why this feature exists — what problem or opportunity it addresses]
**What it does:**    [Plain language — what the user would see or experience]
**Success looks like:** [How we know it worked — measurable where possible]
**Explicitly out of scope:** [What this does NOT do — prevents scope creep]

---

## 2. CASCADE PLACEMENT

**Entity:**          [agenthub (Hephaestus) | optimaeus HEAD | anamnesis | llm-workflows-pckg]
**Cascade position:** [Position in Hermes→Demiurge→Logos→Hephaestus→Anamnesis→OPTimaeus]
**DB:**              [SQLite (agenthub/hermes) | PostgreSQL (others) | Memgraph | Qdrant]
**New tables/schemas:** [List, or "none"]
**API surface changes:** [New endpoints? Modified contracts? Or "none"]
**Cross-entity contracts:** [New inter-entity data flows? Or "none"]
**Cross-entity impact:** [Which other entities are affected, if any]

Source: ecosystem-architect (Brain) — confirmed against brain/knowledge/ecosystem.md

---

## 3. TECHNICAL APPROACHES

*Always 2-3 options. Never a single proposal.*

### Option A — [Name]
**Summary:**               [One sentence]
**Architecture:**          [2-3 sentences — how it works technically]
**DB design sketch:**      [Schema change or "no change"]
**API surface:**           [New/modified endpoints, or "none"]
**sr-backend assessment:** [Risk level + key concern in one sentence]
**sr-frontend assessment:** [Integration complexity + key concern in one sentence]
**Pros:**                  [Bullet list]
**Cons / Risks:**          [Bullet list]
**Sovereignty:**           [CLEAR | CONDITIONAL: detail | VIOLATION: blocker]
**Corruption test:**       [PASSES | CONCERN: detail]
**Build complexity:**      [XS | S | M | L | XL]

---

### Option B — [Name]
**Summary:**               [One sentence]
**Architecture:**          [2-3 sentences]
**DB design sketch:**      [Schema change or "no change"]
**API surface:**           [New/modified endpoints, or "none"]
**sr-backend assessment:** [Risk level + key concern]
**sr-frontend assessment:** [Integration complexity + key concern]
**Pros:**                  [Bullet list]
**Cons / Risks:**          [Bullet list]
**Sovereignty:**           [CLEAR | CONDITIONAL | VIOLATION]
**Corruption test:**       [PASSES | CONCERN]
**Build complexity:**      [XS | S | M | L | XL]

---

### Option C — [Name] *(if applicable)*
*(same structure as A and B)*

---

**Recommended option:** [A / B / C]
**Reason:** [2-3 sentences]

---

## 4. UX DIRECTIONS

*Always 2-3 directions. Explored by ux-explorer, checked by sr-frontend.*

### Direction 1 — [Name]
**Concept:**             [One sentence — the core UX idea]
**User flow:**           [Step-by-step in plain language]
**Key components:**      [List of UI elements / interactions needed]
**Aesthetic fit:**
  agenthub:              [Fits | Conflicts | N/A]
  optimaeus HEAD:        [Fits | Conflicts | N/A]
  anamnesis:             [Fits | Conflicts | N/A]
**sr-frontend verdict:** [HIGH | MEDIUM | LOW feasibility — one sentence reason]

### Direction 2 — [Name]
*(same structure)*

### Direction 3 — [Name] *(if applicable)*
*(same structure)*

**Recommended direction:** [1 / 2 / 3]
**Reason:** [2-3 sentences]

---

## 5. RISK REGISTER

*Produced in Phase 5 (dev-stack review) + Phase 6 (signal protocol).*

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | H/M/L | H/M/L | [Action] |
| [Risk 2] | H/M/L | H/M/L | [Action] |
| [Risk 3] | H/M/L | H/M/L | [Action] |

**DB migration risk:**    [None | Low | Medium | High: detail]
**Cascade compliance:**   [Clear | Conditional: detail | Violation: blocker]
**Breaking change:**      [None | Low: scope | Medium: scope | High: requires versioning]
**Sovereignty:**          [Compliant | Conditional: action | Breach: blocker]

---

## 6. TECHNICAL SIGNALS RAISED

*(From Phase 6 — Proactive Signal Protocol + technical layer)*

| Signal | Summary | Direction | Status |
|--------|---------|-----------|--------|
| [signal type] | [summary] | [direction] | OPEN/ADDRESSED/WAIVED |

---

## 7. BRAIN ALIGNMENT STAMP

**Cascade compliance:**   [CLEAR | FLAG: detail]
**Sovereignty verdict:**  [COMPLIANT | CONDITIONAL | VIOLATION]
**Philosophy alignment:** [Does this respect the corruption test and the six cores?]
**Phase 1/2 alignment:**  [YES | PARTIAL: note | NO: conflict]

**lead-brain co-sign:**   [CLEAR TO PROCEED | CONDITIONAL | HOLD]

---

## 8. RECOMMENDED PATH FORWARD

**Technical option:**     [A | B | C]
**UX direction:**         [1 | 2 | 3]
**Sprint size estimate:**  [XS | S | M | L | XL | Needs decomposition]
**Suggested sprint name:** [e.g., "R8: Anamnesis Write Layer — Hephaestus side"]
**Pre-requisites before dev-stack can start:**
  - [ ] [Pre-req 1, or "None — ready to implement"]

---

## USER APPROVAL

- [ ] User approves technical option [A / B / C]
- [ ] User approves UX direction [1 / 2 / 3]
- [ ] User confirms sprint scope (or requests decomposition)
- [ ] User acknowledges risk register
- [ ] Feature Brief handed to dev-stack lead for sprint planning
- [ ] Data team notified to deposit FEAT record
- [ ] project-navigator (Brain) updates projects-current.md

**Approved on:** ___________
**User notes:** ___________
