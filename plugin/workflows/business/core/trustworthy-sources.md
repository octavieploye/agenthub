# Trustworthy Sources — Business Research Standard

> Canonical definition: `.claude/skills/trustworthy-sources/SKILL.md`
> This file is a copy for the business research workflow context.

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
| 4 | Corporate research (Google, Microsoft, Meta, Anthropic…) | Never alone — needs 4+ non-corporate sources |
| 5 | Industry blog, Medium, Substack | Never alone |
| 6 | Single LLM output | Never |

## Why Corporate Is Not Trustworthy

Corporate labs select topics, frame findings, and control release timing to serve product narratives. Structural bias, not fraud. Counter it with volume and independence.

## Independence Test

Sources are independent when: different funding, different institutions, different methodologies, conclusions reached without referencing each other.

5 papers citing the same original study = 1 source, not 5.

## Red Flags

- "Studies show" without citation
- Single corporate whitepaper as sole evidence
- Multiple sources all citing one original paper
- Sources describing adjacent topics, not directly testing the claim

## Citation Format

State: number of sources, tier, and independent convergence.

**Wrong:** "Research shows X." (one corporate source)
**Right:** "5 independent academic sources (1 RCT + 4 multi-institution studies) converge on X."
