---
name: team-brainstorm
description: Business Idea Workshop — structured exploration, challenge, and synthesis of any idea. Produces a single Idea Brief with verdict, financial signals, risk assessment, and actionable next steps.
---

# Business Idea Workshop

Explore any idea — product, feature, business model, content strategy, or creative direction — through structured exploration, adversarial challenge, and synthesis. Produces ONE cohesive Idea Brief that serves founders, product managers, project managers, and non-technical decision-makers equally. Required input for the tech-brainstorm team if the idea routes to a technical build.

## When to Use

- User has an idea and wants it stress-tested before investing time or money
- User needs a structured evaluation to present to stakeholders, partners, or co-founders
- User wants to compare 2-3 directions before committing
- Before any milestone, pivot decision, or new product line exploration

## What You Need Before Starting

- An idea, topic, or question from the user (any level of vagueness is fine — concept-explorer handles clarification)
- Brain team context loaded (philosophy.md, memory/index.md) — lead-brain co-chairs this session

## What This Team Produces

A single **Idea Brief** document with 8 sections:

1. **Idea Summary** (150-250 words) — what, who, what problem
2. **Verdict & Recommendation** (100-200 words) — PROMISING / CONDITIONAL / RETHINK NEEDED + key conditions
3. **Market & Competitive Reality** (300-500 words) — 3-5 alternatives, differentiation, market size in plain language
4. **Challenge Report** (400-700 words) — 7 signals with customer-facing names + traffic lights (Green/Amber/Red)
5. **Financial Signal** (200-400 words) — validate cost, MVP cost, revenue model, margin signal
6. **Risk Assessment** (200-400 words) — top 5 risks table (Risk / Severity / Mitigation) + biggest showstopper
7. **Options** (300-500 words) — 2-3 directions with trade-offs, recommended highlighted
8. **Next Steps** (200-300 words) — "this week" actions + "before investing" validation + next workflow routing

**Total target: 1,800-3,200 words** (~5-8 pages)

### Challenge Report Signal Names

Output uses customer-facing labels — internal names are for agent prompts only:

| Internal Signal | Customer-Facing Label |
|---|---|
| NOT RECOMMENDED | Structural Concerns |
| FINANCIALLY UNSOUND | Financial Viability |
| ALREADY EXISTS | Existing Alternatives |
| MARKET OVERSATURATED | Market Saturation |
| UNSEEN OPPORTUNITY | Hidden Opportunities |
| VISION CONFLICT | Strategic Alignment |
| PRIOR SESSION CONFLICT | Consistency Check |

## Output Formatting Rules

- Write for a mixed audience: founders, PMs, project managers, non-tech decision-makers
- Detailed data with human readability — specific numbers, named competitors, concrete scenarios
- Tables for structured comparisons (competitors, risks, options)
- Traffic lights (Green/Amber/Red) for the challenge report
- Graphs or visual indicators where they add clarity
- No framework jargon (no RICE, TAM/SAM/SOM labels) — describe the content, don't name the framework
- Every section self-contained — a reader who skips to Section 6 should understand it without Sections 1-5

## Output Format

- **Always produce Markdown** (canonical format)
- **At session end**, offer: "Your Idea Brief is ready. Would you like a PDF version for sharing?"
- **Anamnesis**: write to episodic + semantic memory silently when API is reachable
- Notion/Obsidian export: deferred to future platform release

## Agent Sequence (mandatory order)

1. `concept-explorer` — maps the idea across 9 dimensions (no evaluation). Produces data for Sections 1, 3, 5.
2. `idea-challenger` — fires all 7 challenge signals (session gate). Produces data for Sections 2, 4, 6.
3. `synthesis-builder` — produces exactly 2–3 option directions after challenge. Produces data for Sections 2, 7, 8.

Lead-brain loads philosophy.md and surfaces memory/index.md prior sessions before concept-explorer begins.
The lead assembles the final 8-section Idea Brief from all three agents' outputs.

## Key Rules

- idea-challenger MUST fire before synthesis-builder — session gate, not optional
- synthesis-builder produces exactly 2–3 options — never 1, never 4+
- All 7 challenge signals must be addressed — even if "no concern found here"
- Corruption test must run ("if this succeeds and a power-hungry actor acquires it, what do they do?")
- trustworthy-sources skill required before citing any external market data
- Session output is deposited by data team after session closes — never skipped
- Output uses customer-facing signal names — internal names for agent prompts only
- Verdict is a recommendation, not a decision — the user always has the final word
- BMAD is user-request-only — never invoked proactively

## How to Invoke

Tell lead-brainstorm the idea or question. Lead-brainstorm activates lead-brain as co-chair, then runs the three-agent sequence and assembles the final Idea Brief. The user decides which direction to pursue — the team presents, not decides.
