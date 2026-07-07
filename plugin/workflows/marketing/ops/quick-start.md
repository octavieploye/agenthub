# MODULE: ops/quick-start
TYPE:   Operations — minimal guide for low-context LLMs (< 8K window)
OWNER:  lead-marketing
TOKENS: ~300

## USE THIS WHEN
Context window is below 8K tokens. Load this instead of ops/how-to-run.md.
This file gives the minimum needed to run a session without violating core rules.

## MINIMUM LOAD (always in context)

  1. ../business/core/non-assumption-rule.md   — THE ONE RULE
  2. ../business/core/csl-protocol.md          — conflicts go to user
  3. ops/drl-protocol.md                       — missing data goes to business team
  4. handoff/business-to-marketing.md          — run checklist before M1

That is it. Do not load layer modules until needed.

## MODE SELECTION

  User has existing campaign to audit: load R1 → user selects scope
  User is building from scratch (business team has delivered): load M1

  Do not load both forward and reverse simultaneously in low-context mode.

## LAYER ORDER

  Forward: M1 → M2 → M3 → M4 → M5 → M6 → synthesis/l6-synthesis
  Reverse: R1 → [R2, R3, R4, R5 as needed] → synthesis/l6-synthesis
  One module at a time. Unload before loading next.

## THE ONE RULE (summary)

  Never assume a missing persona attribute.
  Never resolve a data conflict yourself.
  Never proceed without business team handoff complete.

  Missing data → DRL item.
  Data conflict → CSL item to user.
  Both block progress until user decides.

## LOW-CONTEXT LAYER EXECUTION

  Load one layer. Complete it. Summarize output in 3-5 bullets.
  Unload the layer module.
  Load the next layer module.
  Hold only the bullet summary of previous layers — not the full output.

  If context fills: summarize completed layers to 2 bullets each before continuing.
