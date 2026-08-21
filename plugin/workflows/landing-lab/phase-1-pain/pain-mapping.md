# Phase 1: Pain Mapping
# Agent: pain-mapper | Input: Product Discovery Brief (user-confirmed) | Output: Pain Mapping Report

## Purpose

Map the real, felt pain of the target audience. Every pain point must be sourced. This report drives all messaging decisions in Phases 2, 3, and 4.

---

## Step 1: Segment Identification

From the Product Discovery Brief, identify 2–3 distinct buyer segments. For each:
- Who: role, context, life stage, or situation
- Status quo: what they currently use or do as a workaround
- Failure point: what is specifically failing about that workaround

Rank segments by pain intensity (Four U's score below determines rank).

---

## Step 2: Four U's Analysis

Apply to each segment. Score each U: **Strong / Moderate / Weak**.

| U | Test question |
|---|---|
| Unworkable | Could this problem get them fired, fail a project, or cause serious harm? |
| Unavoidable | Is this something they literally cannot escape or ignore? |
| Urgent | Is this a top-3 priority right now — not eventually? |
| Underserved | Are current solutions inadequate, expensive, or inaccessible? |

**Threshold:** Minimum 2 Strong U's for a segment to be viable. Flag weaker segments to lead-landing-lab.

Sources for U evidence:
- Customer reviews (App Store, G2, Capterra, Trustpilot)
- Forum discussions (Reddit, Hacker News, niche communities)
- Sales call language provided by user
- Product Hunt comments
- Social media complaints (use for patterns, not as authoritative sources)

All evidence cited. Flag uncited evidence `[UNSOURCED]`.

---

## Step 3: Before / After Framework (top segment only)

**Before:**
- Specific daily frustration in buyer's own words
- Workaround they currently use
- Measurable cost of inaction: time wasted / money lost / risk carried / outcome missed

**After:**
- Concrete relief or gain the product delivers
- Specific — not "better results" but "saves 4 hours per week" or "eliminates the risk of X"

**Classification:**
- **Penicillin** — removes acute pain (urgency + speed messaging required)
- **Morphine** — manages chronic pain (trust + social proof + long-term framing required)
- **Vitamin** — aspirational improvement (desire + social proof + aspiration framing required)

This classification is mandatory input for value-prop-architect and landing-copywriter.

---

## Step 4: Gain / Pain Ratio

For the top segment:

**Gain:** What specific measurable improvement does the product deliver?
(Examples: hours saved per week / revenue increase / risk eliminated / outcome achieved in X time)

**Pain of adoption:**
- Find cost: how hard is it to discover the product?
- Try cost: friction in trialing or onboarding
- Buy cost: price + commitment + contract
- Adopt cost: time to implement and integrate
- Switch cost: what they have to give up from current solution

**Ratio target:** ≥10:1 (order-of-magnitude improvement overcomes buyer inertia)

If ratio < 10:1: flag to lead-landing-lab. Identify which pain-of-adoption components are highest and whether the product can reduce them.

---

## Step 5: Latent vs. Blatant Needs

**Blatant:** Buyer is actively searching for a solution. These are the hooks.
**Latent:** Aspirational. Buyer may not have connected this need to the product yet.

Key question: what specific use case or context turns this product from "nice-to-have" to "mission-critical"? That is the segment and context to lead with in all copy.

---

## Step 6: Verbatim Pain Phrases

Extract 3–5 real phrases buyers use to describe their pain. Only from sourced materials.

Acceptable sources: published reviews, forum posts, user interviews provided by user, documented sales call language.
Unacceptable: invented, inferred, or paraphrased without attribution.

Format:
> "[Exact phrase]" — (source: G2 review, 2024)

Flag any phrase without a source: `[UNSOURCED — do not use in copy]`

---

## Output: Pain Mapping Report

1. Segment table (ranked by Four U's score)
2. Four U's table per segment with evidence
3. Before/After narrative (top segment)
4. Gain/Pain ratio calculation
5. Product classification + framing implication
6. Verbatim pain phrases with sources
7. Latent vs. blatant need identification
8. Any segments flagged as weak (below 2 Strong U's) with recommendation
