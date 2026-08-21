# Stage 1 — Competitor & Trend Research

**Agent:** competitor-trend-researcher
**Active agents:** 1
**Skip condition:** Existing brief present and < 30 days old

## Purpose
Research same-category websites and current design trends. Produce a Trend Brief.

## Competitor Teardown Protocol
For each competitor found, extract:
- **Positioning** — what they claim, who they target
- **Pricing** — transparent or hidden, tiers, anchoring
- **Trust signals** — testimonials, logos, guarantees, certifications
- **Conversion mechanics** — CTA placement, urgency, lead magnets
- **Layout structure** — section ordering, above-the-fold content
- **Animation style** — motion language, scroll effects

## Trend Extraction
Use chrome-devtools MCP (navigate_page, take_screenshot, evaluate_script, take_snapshot) on:
- awwwards.com, i-designaward.com, land-book.com, mobbin.com, refero.design

Research 5 focus areas:
1. Layout patterns — above-fold structures, hero layouts, section ordering
2. Typography trends — font pairings, size scales, weight contrast, variable fonts
3. Color direction — dark/light mode conventions, gradient usage, muted vs saturated
4. Visual hierarchy — how leading products structure attention flow
5. UI conventions — cards, nav patterns, feature grids, pricing tables, testimonials

## Industry Adaptation (from UI/UX Pro Max)
Apply category-specific constraints:
- Healthcare: WCAG AAA, calm colors, no motion-heavy animations
- Financial/Fintech: security-first, dark mode for dashboards
- Government: WCAG AAA, keyboard navigation, plain-language copy
- B2B: professional tone, no playful design, credential display
- E-commerce luxury: depth, texture, no flat design

Adapt constraints to the resolved category. If category is novel, flag "no verified match" and label guidance as fallback.

## Quality Rules
- 5-source convergence: no trend accepted without 2+ independent sources
- Max 5 WebSearch rounds — report gaps honestly
- Zero-fabrication: never present thin data as confident trends

## Output
Trend Brief written to: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-trend-brief.md`
