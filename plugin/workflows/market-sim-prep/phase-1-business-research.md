# Phase 1 — Business Research
Lead: lead-business
Teammates: market-researcher → business-analyst → [strategist + positioning-expert in parallel]
Gate output: PHASE-1-OUTPUT package → lead-data

---

## OBJECTIVE

Map the full market reality around the product — audiences, pains, competitors, macro forces, geographic signals. Do not filter. Do not pre-select. Surface everything that could be true. Phase 2 will structure it; Phase 3 will validate it.

Business strategy destructuring rule applied here: **go wide before going narrow.** The purpose of this phase is to find ALL potential markets and segments — including ones you didn't expect. The narrowing happens in Phase 4 (simulation), not here.

---

## MODE: REVERSE (R1 → R5) + FORWARD SUPPLEMENT (F3 + F5)

Because we have a known product, run REVERSE first (understand the world around what already exists), then supplement with FORWARD modules F3 (market map) and F5 (buyer psychology) to catch segments the reverse scan misses.

---

## STEP 1 — R1: NICHE + ICP MAPPING (market-researcher leads)

**Task:** Map every persona who could plausibly benefit from this product. Do not limit to the originally intended audience.

For each persona, capture:
```
PERSONA CARD
============
Name:              [descriptive title, not a job title — "the agency owner doing client delivery"]
Demographic:       [age range, role, company size, geography]
Current behavior:  [what do they do today to solve this problem? what tools/processes?]
Primary pain:      [in their own language — not the product's language]
Secondary pain:    [what else is broken in this area of their work?]
Trigger event:     [what specific moment makes them search for a solution RIGHT NOW?]
Pain strength:     [1–10, with reasoning]
Purchase capacity: [estimated monthly budget for this category]
Discovery channel: [where does this person find new tools? How do they buy?]
Emotional driver:  [what identity shift does solving this pain enable?]
```

Produce a minimum of 8 persona cards. More is better at this stage. Do not rate them — that is Phase 4's job.

**Sources to pull from:**
- Reddit threads (r/ChatGPT, r/ClaudeAI, r/cursor, r/localllama, r/freelance, r/marketing, r/smallbusiness) — look for pain language in the comments, not the posts
- Product Hunt reviews of competitors — what do 3-star and 4-star reviews say? (Not 5-star — that is marketing. Not 1-star — that is rage. 3–4 star is reality.)
- G2 / Capterra reviews of any competitor or adjacent tool
- LinkedIn discussions, not LinkedIn articles
- Job posting language — what problems is this role hired to solve?
- Hacker News comments (not posts) on related launches

---

## STEP 2 — R2: COMPETITIVE LANDSCAPE (market-researcher + business-analyst)

**Task:** Map every player who addresses any of the personas identified in R1 — directly or partially.

For each competitor:
```
COMPETITOR CARD
===============
Name:              [product name]
Category:          [direct competitor / adjacent tool / upstream dependency / downstream substitute]
Audience served:   [which of our personas does this address?]
Core value prop:   [in one sentence, what do they promise?]
Pricing model:     [free / freemium / one-time / subscription — with price point]
Deployment model:  [cloud / local / hybrid]
Key weakness:      [what is the #1 complaint in their reviews?]
Key strength:      [what do their most loyal users say they can't live without?]
Switching cost:    [how hard is it for a customer to leave this tool?]
Our gap vs. them:  [what does our product do that this one doesn't — or vice versa?]
```

Minimum 6 competitor cards. Include at least 1 free tool with large user base. Include at least 1 tool that targets a persona we haven't focused on — the "accidental competitor."

**Critical check:** For any market where a free tool with >500K users exists — name it. Do not minimize it. This is a market force, not a threat to hide.

---

## STEP 3 — R3: MARKET MAP (business-analyst)

**Task:** Define the market(s) this product operates in, estimate sizes, and identify the white space.

```
MARKET MAP
==========
Primary market:       [name and definition]
TAM estimate:         [$ or € — with source and year]
SAM estimate:         [realistic serviceable addressable]
SOM estimate:         [what is reachable in 12 months with current resources]
Growth rate:          [CAGR % — with source]
Market stage:         [emerging / growing / maturing / declining]
White space:          [what segment is underserved that our product could own?]
Adjacent markets:     [markets we could enter after proving the primary]
```

If the product could plausibly operate in more than one market — map all of them. Do not pre-select. List them, estimate each, and let the simulation decide.

---

## STEP 4 — R4 / R5: SECTOR + MACRO FORCES (market-researcher)

**Task:** Identify the structural forces that will amplify or constrain this product's market entry over the next 12–36 months.

```
MACRO FORCE SCAN
================
Regulatory tailwinds:   [laws, compliance requirements that create demand — e.g., EU AI Act]
Regulatory headwinds:   [laws that could restrict the product — e.g., AI liability rules]
Economic forces:        [recession signals / growth signals affecting this buyer's budget]
Technology shifts:      [new capabilities arriving that change what's possible or compete]
Social / behavioral:    [shifts in how the target audience relates to AI / privacy / productivity]
Geo-specific signals:   [anything specific to activated geographic tracks — FR / EU / US]
```

The macro forces are not the plan. They are the wind. Name the direction it is blowing and whether it helps or slows the entry.

---

## STEP 5 — F3: MARKET SEGMENT SCAN (business-analyst + positioning-expert)

**Task:** Run a forward market segment scan to catch any segment the reverse approach missed.

Start from the macro: who in the broad market for "AI-assisted work tools" is NOT yet served by any competitor identified in R2? Map this unserved or underserved space as a named segment with estimated size.

Produce minimum 3 segment descriptions outside the personas already identified. These may seem unexpected — that is the point.

---

## STEP 6 — F5: BUYER PSYCHOLOGY (positioning-expert)

**Task:** For the top 5 personas by pain strength (as assessed so far — preliminary), map the buyer psychology.

```
BUYER PSYCHOLOGY MAP
====================
Persona:               [name]
Status quo emotion:    [what do they feel about their current situation — not their pain, their emotion]
Trigger emotion:       [what do they feel at the moment they start searching for a solution?]
Decision emotion:      [what must they feel to convert — safety? excitement? certainty?]
Identity shift:        [who do they become when this problem is solved?]
Language patterns:     [3 phrases this person actually uses — sourced from R1 research, not invented]
Objection:             [the #1 reason they won't buy — honest, not dismissive]
Objection response:    [what would actually address that objection — not rebut it, address it]
```

This section feeds directly into the emotional positioning work and the business strategy destructuring offer framing. If the language is invented (not sourced from real buyer conversations/reviews), flag it as `[estimated]`.

---

## STEP 7 — G-TRACK: GEO BUYING PSYCHOLOGY (positioning-expert + market-researcher)

**Task:** For each geographic territory activated in the INPUT BRIEF (FR / EU / US / GLOBAL / specific countries), research and document how buyers in that market psychologically relate to purchasing in this category.

This is not a macro force scan. This is human psychology research: what does spending money mean to a buyer in this country? What triggers their wallet? What closes the conversation before it begins?

The simulation in Phase 6 builds scenario cards using this data as the behavioral foundation. Without it, the simulation invents buyer behavior — which is the single most dangerous form of assumption in the entire workflow.

```
GEO BUYING PSYCHOLOGY PROFILE
==============================
Country/Region:
Core buying frame:      [spend-frame (EU) or invest-frame (US) — and local variations]
Primary trust signals:  [what earns the right to be considered a serious vendor]
Primary objections:     [the 2–3 objections that appear before any price discussion]
Price relationship:     [how they relate to price — what framing unlocks vs. blocks]
ROI language:           [exact words and frames they use to name value in this category]
Social proof pattern:   [peer referral / expert endorsement / case study / community / demo]
Risk tolerance:         [what level of risk do they accept before seeing proof?]
Buying speed:           [fast / deliberate / committee-driven / seasonal]
Cultural objection:     [the objection rooted in cultural convention, not product evaluation]
Emotional open door:    [the specific emotional state that makes them open to buying today]
Red flags:              [things that immediately close the conversation — by cultural convention]
```

**Known differences to research per territory:**

*EU territories:* The foundational frame is spend — "buying makes me poorer, costs more work, more dependency." Proof burden sits entirely with the seller. Urgency tactics backfire. Peer validation precedes price discussion.

*US territories:* The foundational frame is invest — "buying opens opportunity, what is my ROI?" Pain of inaction is as powerful as gain framing. Speed of decision is higher. Competitive framing activates urgency.

*Within EU:* France (sophistication filter, earned credibility), Germany (technical reliability, specification-driven), Nordics (functional value, community trust, anti-hype), Italy (relational, person before product), Spain (community validation, peer approval), Netherlands (pragmatic, price/value ratio, direct), Eastern Europe (post-Soviet skepticism, proof first, stable pricing).

*Outside EU/US:* Research specifically — do not assume EU-frame or US-frame applies. North Africa, Gulf States, Sub-Saharan Africa, South Asia, East/Southeast Asia, Australia each have distinct buying psychology that does not map cleanly to either frame.

**Sources to pull from:**
- Academic and commercial cross-cultural consumer behavior research (Hofstede dimensions are a starting point, not a conclusion)
- Localized Reddit, forums, LinkedIn discussions in target language where possible
- Review patterns on local e-commerce or SaaS review platforms
- Interview transcripts or buyer journey studies published by local market research firms

Produce one profile per activated territory. Flag any profile where sourced data is thin — mark as `[estimated]` and note what would be needed to verify.

---

## SYNTHESIS — PHASE 1 OUTPUT PACKAGE

lead-business compiles the full PHASE-1-OUTPUT package. It must contain:

```
PHASE-1-OUTPUT CHECKLIST
=========================
[ ] Minimum 8 persona cards (R1)
[ ] Minimum 6 competitor cards (R2)
[ ] Market map with TAM/SAM/SOM + growth rate (R3)
[ ] Macro force scan with geo-specific signals (R4/R5)
[ ] Minimum 3 additional segment descriptions (F3)
[ ] Buyer psychology maps for top 5 personas (F5)
[ ] Geo buying psychology profile for each activated territory (G-track) — flagged [estimated] where data is thin
[ ] Lead-business synthesis: top 3 open questions this phase did not answer
[ ] Lead-business flag: any conflict or contradiction found in the research (CSL items)
[ ] ceo-advisor review: final sanity check — "does this picture feel like market reality?"
```

Gate 1 check (before handing to Phase 2): all checklist items complete; no sourced claim without citation; no point estimate without at minimum an estimated range.

Hand off to lead-data with this package plus the original INPUT BRIEF.

---

## TIMING GUIDE

Full Phase 1 with 8 personas, 6 competitors, full market map: 3–5 session hours.
Abbreviated (4 personas, 3 competitors, abbreviated market map): 1–2 session hours. Use abbreviated only if time constraint in INPUT BRIEF explicitly requires it — and flag the abbreviation in the output.

---

## WHAT THIS PHASE DOES NOT DO

- Does not recommend a target market — that is Phase 4 (simulation)
- Does not evaluate the product's offer — that is Business Strategy Destructuring (/destructuring-business)
- Does not produce statistics with confidence intervals — that is Phase 3 (stats)
- Does not make positioning decisions — that is after Business Strategy Destructuring (/destructuring-business)
- Does not filter personas based on "most likely to buy" intuition — all are documented
