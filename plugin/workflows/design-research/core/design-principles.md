# Core: Design Research Principles

## Non-Assumption Rule

Never state a design trend, pattern, or best practice as fact without a source. Every claim must be grounded in an observed example, published reference, or verified pattern from a real product. When sources conflict, report both perspectives and note the tension.

## Source Discipline

Apply the 5-source convergence rule: a pattern is only reported as a trend when at least 3 independent credible sources confirm it. Single-source observations are reported as "emerging signals", not trends.

Preferred sources for design research:
- Design galleries: Awwwards, Mobbin, Screenlane, Refero, Land-book
- Official documentation: Tailwind CSS docs, DaisyUI docs, MDN Web Docs
- Academic/research: Nielsen Norman Group, Baymard Institute (UX), Smashing Magazine (peer-reviewed)

Not acceptable as primary sources: Medium posts, Reddit threads, generic top-10 blog posts. These can corroborate but cannot anchor a finding.

## Scope Boundaries

Each agent stays in their lane:
- competitor-trend-researcher: visual patterns, layout, typography, color
- emotion-ux: emotional architecture, trust, delight, friction
- animation-engineer: motion, interaction, Tailwind classes, performance

Cross-lane signals should be flagged and handed off — not absorbed into the current agent's report.

## Performance-First Design

Any animation or interaction pattern documented must include a performance note. Patterns that risk CLS, FID, or LCP degradation must be flagged explicitly. Lead-design-research may reject patterns without performance assessment.

## Freshness Rule

Design trends move fast. All trend data should be from sources within the last 18 months. Sources older than 2 years must be flagged as "historical reference, may be outdated."
