---
name: trustworthy-sources
description: Use when evaluating whether a source is credible enough to support a factual claim, cite as evidence, or justify a design, architectural, or business decision.
category: business-analysis
---

# Trustworthy Sources

## Definition

A source is trustworthy for an empirical claim when it meets ONE of:

1. **Convergence rule** — 5+ independent sources from different institutions reach the same conclusion
2. **RCT rule** — a single peer-reviewed randomized controlled trial (RCT) directly tests the claim

## Source Hierarchy

| Tier | Type | Trustworthy alone? |
|------|------|--------------------|
| 1 | Peer-reviewed RCT | Yes |
| 2 | Multi-institution academic study (arXiv, journal) | Only with 2+ corroborating sources |
| 3 | Government / regulatory body | Only with 2+ corroborating sources |
| 4 | Corporate research (Google, Microsoft, Meta, Anthropic…) | Never alone — needs 4+ non-corporate corroborating sources |
| 5 | Industry blog, Medium, Substack | Never alone |
| 6 | Single LLM output | Never |

## Why Corporate Is Not Trustworthy

Corporate research labs select topics, frame findings, and control release timing to serve product narratives. This is structural bias, not fraud. Counter it with volume and independence.

A claim backed only by Microsoft Research, Google Brain, or Anthropic requires 4+ independent non-corporate sources before it can be cited as supporting evidence.

## Independence Test

Sources are independent when they:
- Have different funding sources
- Have different institutional affiliations
- Reached their conclusion without referencing each other
- Used different methodologies

5 papers all citing the same original study = 1 source, not 5.

## Red Flags — Stop and Re-verify

- "Studies show" without citation
- A single corporate whitepaper as sole evidence
- Multiple sources all citing one original paper
- Preprints with no corroboration
- Sources that describe adjacent topics but do not directly test the claim

## How to Cite Correctly

State: number of sources, their tier, and whether they converge independently.

**Wrong:** "Research shows 20x compression is possible." (one corporate source)

**Right:** "5 independent academic sources (1 arXiv RCT + 4 multi-institution studies) converge: 2-5x compression at system prompt level with <2% quality loss."

## Pressure-Test Reminder

This is a reference skill. Retrieval test: given a claim + source list, can an agent correctly classify whether the evidence is trustworthy? Gap test: does the skill cover all common source types encountered in business and technical research?
