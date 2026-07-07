# MODULE: brainstorm/ops/proactive-signal-protocol
TYPE:   Protocol — loaded by idea-challenger and all Brain team co-chairs at every session
OWNER:  idea-challenger (brainstorm) + lead-brain (brain co-chair)
SCOPE:  Applies to both brainstorm and tech-brainstorm teams

---

## WHAT THIS PROTOCOL IS

Agents and LLMs working in brainstorm or tech-brainstorm sessions are NOT passive
respondents. They are OBLIGATED to surface concerns proactively — before the user
commits to an idea, before resources are spent, before the team falls in love with
something that should have been challenged earlier.

This protocol defines the 7 signals that must be checked at every session.
It fires in the CHALLENGE phase — before synthesis, before options are produced.
It also fires in tech-brainstorm Phase 3 (validation) for technical signals.

**The rule:** Every concern must come with a direction.
A 'no' without 'but here is what instead' is not an acceptable output.
The goal is not to block ideas — it is to redirect them toward what will actually work.

---

## THE 7 PROACTIVE SIGNALS

### SIGNAL 1 — NOT RECOMMENDED
**Trigger:** The idea has a fundamental flaw that makes it inadvisable to pursue.
**What to surface:**
  - The reason it is not recommended (specific, not vague)
  - What that flaw would cause if ignored
  - A redirected direction that solves the underlying goal differently
**Format:**
  > "NOT RECOMMENDED: [reason]. If we pursued this, [consequence]. Instead, consider [alternative direction]."

---

### SIGNAL 2 — FINANCIALLY UNSOUND
**Trigger:** The economics of the idea don't work given what we know about the business model,
  target market, cost structure, or revenue potential.
**What to surface:**
  - The specific economic problem (unit economics, wrong monetization model, market too small, etc.)
  - What financially sound looks like for this type of idea
  - A path that addresses the same goal with better economics
**Format:**
  > "FINANCIALLY UNSOUND: [specific problem]. A sound version of this idea would [adjustment]. Consider [direction]."
**Note:** The brainstorm team does not conduct deep financial modeling — it flags structural
  economic red flags. Deep financial analysis is a business team task.

---

### SIGNAL 3 — ALREADY EXISTS
**Trigger:** The idea already exists in the market (as a product, service, or pattern)
  OR within the Optimaeus ecosystem (already built or already planned).
**What to surface:**
  - What exists already (by name if known)
  - Whether the existing solution is a competitor or a potential reference
  - What angle or differentiation could make the idea still viable
  - If it already exists in the Optimaeus ecosystem: cite the entity and its current status
**Format:**
  > "ALREADY EXISTS: [what exists]. This means [implication]. A differentiated angle could be [direction]."
**Check:** memory-curator (Brain) checks prior session records. ecosystem-architect (Brain) checks the Optimaeus cascade.

---

### SIGNAL 4 — MARKET OVERSATURATED
**Trigger:** The target market for the idea is crowded with established players and
  the idea as described offers no clear differentiation.
**What to surface:**
  - How saturated the market is and who the dominant players are (at signal level — not deep research)
  - What the saturation means for entry viability
  - An adjacent unsaturated or underserved space that addresses the same user need
**Format:**
  > "MARKET OVERSATURATED: [who dominates]. Entry as described is [risk level]. An adjacent opportunity: [direction]."
**Note:** Deep competitive analysis is the business team's role. This signal flags at the concept level.

---

### SIGNAL 5 — UNSEEN OPPORTUNITY
**Trigger:** In the process of exploring the idea, an agent identifies a direction,
  angle, or opportunity that the user or previous teams have not considered.
  This is a positive signal — not a concern, but a proactive contribution.
**What to surface:**
  - The unseen opportunity in specific terms
  - Why it is a better or complementary direction
  - What it would require to pursue
  - Which team should explore it further
**Format:**
  > "UNSEEN OPPORTUNITY: [what we see that you have not]. This is worth pursuing because [reason]. To explore: [direction + team]."

---

### SIGNAL 6 — VISION CONFLICT
**Trigger:** The idea conflicts with the Optimaeus founding principles, sovereignty ethos,
  philosophical position, or stated vision.
  Owner: strategy-advisor and lead-brain (Brain team) — they hold the vision.
**What to surface:**
  - Which specific principle the idea conflicts with
  - How the conflict manifests (e.g., "this would require AWS" / "this creates lock-in"
    / "this stores user data in a way that violates sovereignty")
  - A version of the idea that achieves the goal without the conflict
**Format:**
  > "VISION CONFLICT: [which principle]. [How the conflict appears]. A compliant version: [direction]."
**Reference:** brain/knowledge/philosophy.md — the vision, sovereignty ethos, and corruption test.

---

### SIGNAL 7 — PRIOR SESSION CONFLICT
**Trigger:** The idea conflicts with or duplicates work already done in a prior session
  (business research, marketing analysis, brainstorm, or brain knowledge update).
  Owner: memory-curator (Brain team) — they hold the memory.
**What to surface:**
  - The record ID(s) of the prior session(s)
  - What was decided or found previously
  - Whether this idea changes that prior decision or is duplicating explored ground
  - Whether the prior session's output should be loaded before continuing
**Format:**
  > "PRIOR SESSION CONFLICT: [record ID]. In that session, [what was found/decided]. This idea [confirms/conflicts/duplicates] that. Recommend [action]."

---

## WHEN SIGNALS FIRE

### In the BRAINSTORM session:
  Fires in Phase 3 — CHALLENGE (before synthesis)
  Run by: idea-challenger
  Supported by: Brain team co-chairs (who may add signals from their domain)
  All 7 signals checked. Any that apply are surfaced together before synthesis begins.

### In the TECH-BRAINSTORM session:
  Signals 1, 2, 3, 6, 7 fire in Phase 6 — VALIDATE (after technical options are on the table)
  Run by: feature-architect (technical signals) + idea-challenger equivalent
  Additional technical signals at this stage:
    - TECHNICALLY INFEASIBLE: the approach cannot be built within the cascade constraints
    - CASCADE VIOLATION: the approach would break inter-entity data flow rules
    - BREAKING CHANGE: the approach would break existing contracts without a migration path

---

## SIGNAL OUTPUT FORMAT

All signals raised in a session appear together in the Idea Brief (or Feature Brief)
under a dedicated section: "PROACTIVE SIGNALS RAISED".

Format per signal:
```
[SIGNAL TYPE] — [one-sentence summary]
  Detail: [2-3 sentences]
  Direction: [what to do instead or additionally]
  Owner: [which agent surfaced this]
  Status: OPEN | ADDRESSED | ACCEPTED BY USER | WAIVED BY USER
```

If the user waives a signal, it is recorded as WAIVED in the Idea Brief and
deposited in the memory record for cross-session tracking.

---

## WHAT THIS PROTOCOL DOES NOT DO

  Does not replace deep business research (business team does that)
  Does not conduct competitive analysis (business team / marketing team)
  Does not do financial modeling (future financial team)
  Does not block ideas — redirects them
  Does not override the user (user may waive any signal with explanation)
