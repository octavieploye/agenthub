# MODULE: ops/drl-protocol
TYPE:   Operations — load whenever a DRL item needs to be created
TOKENS: ~400

## PURPOSE
The Data Request List (DRL) is the marketing team's non-assumption mechanism
for missing data. It is parallel to the CSL but for upstream data gaps rather
than source conflicts.

CSL = two sources conflict → user resolves which to trust
DRL = data is missing that cannot be assumed → business team provides it

Both are numbered lists presented to the user.
Both block progress until resolved.
Neither is ever resolved by agent assumption.

## WHEN TO CREATE A DRL ITEM
- A persona attribute is needed but not present in the ICP Profile
- A market size or segment data point is missing from business team inputs
- A competitor profile is referenced but not fully delivered
- A macro force or TTA tag is missing that affects readiness assessment
- A channel selection decision requires demographic data not in the ICP Profile
- A message element requires buyer language not in the Messaging Brief
- Performance data (reverse mode) reveals a persona assumption with no evidence

## DRL ITEM FORMAT

ID:        DR-[number, sequential per session]
Layer:     [M1 / M2 / M3 / M4 / M5 / M6 / R1 / R2 / R3 / R4 / R5]
Missing:   [exact data point or profile element that is absent]
Why:       [what marketing decision this data unlocks — one sentence]
Blocked:   [which module step cannot proceed without this — be specific]
Request:   [exact question to send to business team — precise, answerable]
Status:    Pending / Requested / Received / Waived (by user decision)

Example:
  ID:      DR-003
  Layer:   M1
  Missing: Family status distribution within target ICP (parents vs. non-parents)
  Why:     Channel and content format differ significantly between parents
           (Facebook, short video, schedule-constrained) and non-parents
           (Instagram, longer content, flexible schedule)
  Blocked: M1 Step 4 — family status persona split cannot be completed
           M4 Step 2 — channel weighting by lifestyle cannot be calculated
  Request: "In the ICP research, what proportion of the target buyer has children
           under 18? Is the primary buyer more likely to be a parent or not?"
  Status:  Pending

## PRESENTING DRL ITEMS TO THE USER
All DRL items collected in a layer are presented as a numbered list
before the layer closes — same discipline as CSL.

Format:
  DATA REQUESTS — Layer [M1] — [N] items

  DR-001 [M1]: Missing: [one line]. Request to business team: "[exact question]"
  Options: A) Send request to business team now  B) Proceed without — note gap
           C) User provides the data directly     D) Waive — accept unknown
  Decision: ___

  DR-002 ...

User records a decision on every item before marketing proceeds.

## DRL RESOLUTION PATHS

A) Request to business team
   lead-marketing sends the exact DRL request to business team
   Business team opens a targeted research sub-task
   Marketing layer pauses until data is received
   When received: data enters as Tier 1-3 signal, CS scored, layer resumes

B) Proceed without — note gap
   Gap is documented in the layer output
   Any finding that depends on this gap is marked CS: [lowered score]
   A note appears in synthesis: "Finding X rests on unverified assumption — see DR-00N"

C) User provides the data directly
   User states the data — it is recorded as Tier 0 (user-provided)
   Entered into the layer output with CS: 70 (user-stated, single source)
   No further DRL item needed

D) Waive — accept unknown
   Gap is documented
   No finding is built on this data point
   Synthesis notes the gap as a known blind spot

## WHAT IS NOT A DRL ITEM
Normal research uncertainty (CS reflects this)
Data that can be sourced from marketing-specific sources (persona-profiler
can source some demographic data independently — it does not all come from business team)
Data that is out of scope for the current project
