# Phase 2 — Data Analysis
Lead: lead-data
Teammates: data-architect → [opportunity-analyst + risk-analyst in parallel]
Input: PHASE-1-OUTPUT from lead-business
Gate output: PHASE-2-OUTPUT package → lead-stats

---

## OBJECTIVE

Transform the raw research of Phase 1 into a structured, queryable intelligence package that Phase 3 (stats) can validate with numbers and that the simulation can model against.

Phase 2 does not add new research. It organizes what Phase 1 found, finds patterns across the findings, identifies contradictions, surfaces the strongest opportunities, and names the risks that Phase 1 may have surfaced but not analyzed.

---

## STEP 1 — DEPOSIT (data-architect)

Run the standard deposit protocol on the PHASE-1-OUTPUT package.

For each sub-component of Phase 1, create a separate record:
- Persona cards → deposit as `business-record` type, one record per persona
- Competitor cards → deposit as `business-record` type, tagged `[competitor]`
- Market map → deposit as `business-record` type, tagged `[market-map]`
- Macro force scan → deposit as `business-record` type, tagged `[macro]`
- Buyer psychology maps → deposit as `business-record` type, tagged `[buyer-psychology]`
- ceo-advisor review → deposit as `business-record` type, tagged `[review]`

Update memory/index.md with all new record IDs and a 1-line summary for each.

Confirm deposit is complete before any analysis begins.

---

## STEP 2 — OPPORTUNITY MAPPING (opportunity-analyst)

**Task:** Scan the deposited records for cross-cutting patterns that represent market entry opportunities.

For each opportunity identified:
```
OPPORTUNITY SIGNAL
==================
Signal ID:         [unique ID — OSS-[number]]
Type:              [segment gap / competitor weakness / macro tailwind / buyer psychology unlocked]
Source records:    [cite minimum 2 record IDs that support this signal — no single-record signals]
Description:       [what is the opportunity, specifically?]
Audience segment:  [which persona(s) does this opportunity serve?]
Size estimate:     [rough: large / medium / small — do not estimate a number without Phase 3 validation]
Time sensitivity:  [now / 3 months / 12 months / long-term]
Confidence:        [CS score 0–100 — using confidence-scoring protocol]
Dependency:        [what must be true for this opportunity to be real?]
```

Minimum 5 opportunity signals. Maximum: as many as the data supports. Every signal must cite at least 2 source records. If only 1 record supports a signal, place it on the watchlist, not in the opportunity list.

**Special instruction for this workflow:** Look specifically for opportunities across MULTIPLE audience segments simultaneously — signals where the same product capability addresses the same root pain in 2+ different personas. These are the most valuable signals for the simulation (they indicate a potential broadly-positioned offer, not a niche play).

---

## STEP 3 — RISK MAPPING (risk-analyst)

**Task:** Scan the deposited records for risks, contradictions, and blind spots.

For each risk or contradiction:
```
RISK SIGNAL
===========
Signal ID:         [RSS-[number]]
Type:              [market risk / competitive risk / adoption barrier / blind spot / contradiction]
Source records:    [cite specific record IDs]
Description:       [what is the risk, specifically?]
If contradiction:  [Record A says X, Record B says Y — surface, do not resolve]
Severity:          [critical / significant / watch]
Probability:       [estimated likelihood — low / medium / high — without CS score, Phase 3 will score]
Dependency:        [what must happen for this risk to materialize?]
```

All CSL (Conflict Surface List) items from Phase 1 must appear here as `[contradiction]` type risks.

**Special instruction:** For the sovereignty/privacy positioning angle — run a specific risk check: does any competitor offer sovereignty + the same productivity capability at a lower price? If yes, flag as CRITICAL. If no, note as a confirmed moat element.

---

## STEP 4 — CROSS-SESSION BRIEFING (lead-data)

**Task:** Check the memory index for any prior sessions on adjacent topics.

If any prior session records exist that are relevant to this product/market:
- Pull those records
- Note where prior findings confirm the current Phase 1 research (confidence boost)
- Note where prior findings contradict current Phase 1 research (CSL item)
- Surface any patterns from prior sessions that Phase 1 did not find independently

If no prior sessions exist: note explicitly — "No prior session records found. This is a first-run on this market."

---

## STEP 5 — SYNTHESIS (lead-data)

Produce the PHASE-2-OUTPUT package:

```
PHASE-2-OUTPUT STRUCTURE
=========================
1. DEPOSIT CONFIRMATION
   - Record count: [number]
   - Record IDs: [list all]
   - Index updated: [yes/no]

2. OPPORTUNITY SIGNALS
   - [OSS-001 through OSS-N: full signal cards]
   - Top 3 opportunities by confidence score (CS ≥ 50)
   - Watchlist signals (CS < 50 or single-record support)

3. RISK SIGNALS
   - [RSS-001 through RSS-N: full signal cards]
   - Critical risks: [list]
   - CSL items: [list all contradictions found]

4. CROSS-SESSION FINDINGS
   - Confirmations from prior sessions: [list or "none"]
   - Contradictions from prior sessions: [list or "none"]

5. OPEN QUESTIONS FOR PHASE 3 (STATS)
   - What does Phase 1 claim that Phase 3 must validate with numbers?
   - Which market size estimates need statistical corroboration?
   - Which buyer psychology patterns need behavioral economics backing?
   - Which risk probabilities need quantification?
   [Minimum 5 specific questions — these become the Phase 3 work agenda]

6. LEAD-DATA ASSESSMENT
   - Overall research quality from Phase 1: [strong / adequate / thin — with reasoning]
   - Recommended focus for Phase 3: [which opportunity signals deserve the most statistical attention]
   - Any Phase 1 gaps that Phase 3 cannot compensate for: [named explicitly]
```

---

## HANDOFF TO PHASE 3

Hand the PHASE-2-OUTPUT package to lead-stats with:
- The original INPUT BRIEF
- The list of open questions (item 5 above)
- All deposited record IDs (for Phase 3 to pull specific records if needed)

Confirm with lead-data before handoff: "Has the opportunity-analyst and risk-analyst both completed their outputs? Are all records deposited?"

---

## WHAT THIS PHASE DOES NOT DO

- Does not add new market research — Phase 1 is the research phase
- Does not assign statistical confidence intervals — that is Phase 3
- Does not produce persona recommendations — that is the simulation
- Does not resolve CSL contradictions — it surfaces them; the simulation holds them as model uncertainty
- Does not write strategy — that is after Business Strategy Destructuring (/destructuring-business)
