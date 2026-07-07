# MODULE: reverse/r1-campaign-entry
TYPE:   Reverse Layer — entry point. Load this first when entering with existing campaign.
OWNER:  lead-marketing (delegates to campaign-analyst + competitive-intel-marketing)
TOKENS: ~600

## PURPOSE
Entry point for reverse mode. User brings an existing campaign, ad, content piece,
or marketing asset. This layer maps what exists before judging whether it works.
No evaluation yet — only inventory. Evaluation begins in R2.

REVERSE MODE is for: auditing existing campaigns, diagnosing underperformance,
tracing a campaign back to its strategic roots, validating alignment with ICP.

## WHAT TO BRING TO R1
Any one of:
  - Active ad campaign (paid or organic)
  - Landing page or sales page
  - Email sequence
  - Social media account or content archive
  - Single content piece (article, video, post)
  - Campaign brief or creative brief

User provides the asset or URL/description. lead-marketing validates what is available.

## STEP 1 — ASSET INVENTORY

Catalog everything that exists. Do not evaluate yet.

  ASSET TYPE: [campaign / page / email / social / content / brief]
  CHANNELS IN USE: [list all channels currently active]
  CONTENT FORMATS: [ad / organic post / email / video / article / combination]
  VOLUME: [approximate number of assets — e.g., "12 Facebook ads, 3 landing pages"]
  DATE RANGE: [when this campaign started / how long it has been running]
  GEO ACTIVE: [which markets this campaign runs in]

  Key assets to examine (select up to 3 for deep audit):
    Asset 1: [type + brief description + URL or file ref]
    Asset 2: [type + brief description]
    Asset 3: [type + brief description]

## STEP 2 — EXISTING STRATEGY MAP

Reconstruct the implied strategy from what exists.
Do not ask what the strategy was — infer it from the assets.

  Implied target audience:
    Who does the creative, copy, and channel selection seem to target?
    Age signal:     [from visual style, language level, platform]
    Role signal:    [from ad copy, landing page headline, pain point referenced]
    Stage signal:   [awareness / consideration / decision — from CTA type]

  Implied message:
    What problem does the campaign claim to solve?
    Core claim from H1 / ad headline: "[exact text]"
    CTA used: "[exact text]"
    Proof used: [number / logo / testimonial / none]

  Implied channel rationale:
    Why might this channel have been chosen? [infer — do not assume confirmed]
    Competitor presence on same channel: [from any available data]

  Gaps in current strategy that are visible even before evaluation:
    [any obvious missing element — no ICP, no proof, wrong stage, etc.]
    Note: these are observations, not conclusions. R2 evaluates performance.

## STEP 3 — BUSINESS TEAM HANDOFF CHECK

Before reverse audit proceeds, validate whether business team inputs exist.
Reverse mode can begin without full handoff — but gaps become DRL items.

  ICP Profile available: [YES / NO / PARTIAL]
  Messaging Brief available: [YES / NO / PARTIAL]
  Competitive Gap Matrix available: [YES / NO / PARTIAL]
  Market Context Map available: [YES / NO / PARTIAL]
  Macro Signal Map available: [YES / NO / PARTIAL]

  If NO or PARTIAL on any item:
    Create DRL item — request from business team
    Mark which reverse layers are blocked pending that data
    Proceed with available data — note limitations at CS level

## STEP 4 — REVERSE SESSION SCOPE

User selects scope for this reverse audit:

  FULL AUDIT: R1 → R2 → R3 → R4 → R5 → Synthesis
    Use when: campaign is underperforming and root cause is unknown

  TARGETED AUDIT: select specific layers
    R2 only: "Is this campaign working?"
    R3 only: "Are we on the right channels?"
    R4 only: "Is the message right?"
    R5 only: "Does this campaign serve our overall positioning?"

  User decision: [FULL / R[N] only]

## R1 OUTPUT FORMAT

  CAMPAIGN ENTRY — R1

  Assets inventoried: [N items across N channels]
  Asset summary: [one line per key asset]

  Implied strategy:
    Target: [inferred audience]
    Message: "[core claim from H1/ad headline]"
    Channel: [channels in use]
    Stage: [awareness / consideration / decision]

  Business team handoff status:
    Available: [list]
    Missing (DRL items created): [list]

  Visible gaps (pre-evaluation):
    [observation 1]
    [observation 2]

  Reverse session scope: [FULL / targeted — user decision]
  Next layer: [R2 / specific layer per scope]
