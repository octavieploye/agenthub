# Stage 0 — Intake

**Agent:** lead-ux-challenge
**Active agents:** 1

## Purpose
Gather all inputs before any research or design begins. No work starts until the user confirms.

## Required Inputs
1. **Target category** — what is being designed (e.g., "SaaS analytics dashboard", "handmade goods marketplace")
2. **Mode** — WEBSITE (conversion-first: above-fold, social proof, pricing, CTA) or APPLICATION (task-first: navigation, state visibility, progressive disclosure, zero-config)
3. **Repo target** — which repo will receive the implementation (full path, confirmed by user)

## Optional Inputs
4. **Brand constraints** — colors, fonts, voice (if empty, ui-designer selects post-brainstorm in Stage 3)
5. **Existing brief** — if present and < 30 days old, Stage 1 research is skipped
6. **References** — competitor URLs, inspiration sites, anti-references ("not like this")

## Brief Inference (from Taste)
Before proceeding, output a one-line Design Read:
> "Reading this as: [page kind] for [audience], with a [vibe] language, leaning toward [system/aesthetic]."

If anything is ambiguous, ask at most ONE clarifying question.

## Three Dials (from Taste)
Infer these from the brief — never silently default. State each value with reasoning:

| Dial | Range | Description |
|---|---|---|
| DESIGN_VARIANCE | 1-10 | Asymmetry and visual complexity. 1-3 = symmetrical grids, 8-10 = masonry, fractional grid, massive empty zones |
| MOTION_INTENSITY | 1-10 | Animation amount. 1-3 = hover/active only, 8-10 = scroll-driven, parallax, GSAP |
| VISUAL_DENSITY | 1-10 | Whitespace vs information. 1-3 = art gallery spacing, 8-10 = cockpit-tight |

**Vibe-to-dial reference:**
- minimalist / calm / Linear: 5-6 / 3-4 / 2-3
- corporate / enterprise / Salesforce: 3-4 / 2-3 / 6-7
- playful / Awwwards / experimental: 9-10 / 8-10 / 3-4
- editorial / magazine / NYT: 6-7 / 3-4 / 5-6
- dashboard / data-heavy: 3-4 / 2-3 / 8-9

## Subject Grounding (from Anthropic)
Pin down three facts before proceeding:
1. The **concrete subject** (not "a SaaS" — name it)
2. The **audience** (who visits this page)
3. The page's **single job** (one sentence: what must the visitor do?)

## User Confirmation Gate
**Do NOT proceed to Stage 1 without explicit user approval of:**
- Category + mode + repo target
- Design Read
- Dial values
- Subject grounding

Present all of the above and wait for confirmation.
