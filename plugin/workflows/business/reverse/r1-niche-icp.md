# MODULE: r1-niche-icp
LAYER:  R1 — Niche / Business Entry Point
MODE:   REVERSE
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
core/time-to-action
+ all active geo/ modules

## SKIP IF
User has no prior knowledge of a specific niche or business.
In that case: use FORWARD mode starting at f1-eagle.

## INPUT
Required: ONE of the following (user provides):
  - Business description (1-3 sentences)
  - Industry name + known position within it
  - Vertical or niche name
  - Combination of the above
Required: Active geo-tracks
Optional: Known competitors, known buyer types, known pain points

## PROCESS
1. Map ONLY what is explicitly stated in the user input.
   Do not interpret, expand, or reframe the user's description.
   If the input is ambiguous (e.g., "B2B fintech" alone is not specific enough):
   stop, list the ambiguity as a CSL item, and ask the user to clarify
   before proceeding.

2. Extract from the input only — label source as "user-stated":
   ICP hypothesis: who are the buyers? (only if stated)
   Pain points:    what problems are being solved? (only if stated)
   Competitors:    who are the known players? (only if stated)
   Geo scope:      does the input apply to all active tracks or specific ones?

3. For every element extracted, check:
   Is this stated as fact or is this an assumption embedded in the input?
   Each embedded assumption = CSL item.
   Do not proceed with an assumption as if it were verified.

4. Build knowledge gap map:
   What is NOT in the input that this reverse research must find?
   This becomes the research agenda for R2-R5.

5. Define the focus question — one sentence agreed with the user:
   "This research will answer: [single question]"
   Do not proceed until the user confirms the focus question.

6. Present all CSL items (embedded assumptions) to user before proceeding.

## OUTPUT: Niche Entry Brief
  Business / niche:    [exact user description — not reinterpreted]
  Geo scope:           [which active tracks this applies to]
  Known ICP:           [user-stated only — or "not stated in input"]
  Known pain points:   [user-stated only — or "not stated in input"]
  Known competitors:   [user-stated only — or "not stated in input"]
  Knowledge gap map:   [what R2-R5 must find — specific questions per layer]
  Focus question:      [single research question — confirmed by user]
  Assumptions found:   [numbered list — each is a CSL item]
  CSL items:           [numbered list — present to user and get decisions before proceeding]

## RULE
Never expand the niche definition beyond what the user stated.
Never infer buyer type from industry label alone.
Never assume geographic applicability beyond what the user specified.

## HANDOFF
Reverse feeds: r2-competitive
Gate before handoff:
  - Focus question confirmed by user
  - Knowledge gap map complete
  - All embedded assumptions listed as CSL items
  - User has recorded a decision on every CSL item
