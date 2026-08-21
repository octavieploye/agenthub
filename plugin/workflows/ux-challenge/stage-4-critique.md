# Stage 4 — Six-Critic Review

**Agents:** 6 critics in two waves of 3
**Active agents:** 3 per wave (never all 6 at once)
**Prerequisite:** Stage 3 brainstorm terminated (objection log empty or stalled)

## Purpose
Stress-test the Stage 3 combined draft through 6 persona-driven critics. Each produces a severity-ranked concern list.

## Input
The Stage 3 combined draft at: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-stage3-draft.md`
The orchestrator (lead-ux-challenge) provides the exact file path to each critic.

## Wave Protocol

### Wave 1 (3 agents active)
| Agent | Persona | Focus |
|---|---|---|
| technical-critic | Technical ("show me how it works") | Overclaiming, missing specs, vague architecture |
| sceptical-critic | Sceptical ("prove it") | Unverifiable claims, missing social proof |
| time-to-think-critic | Time-to-Think ("don't rush me") | Pressure tactics, fake urgency, forced signup |

### Wave 2 (3 agents active, after Wave 1 completes)
| Agent | Persona | Focus |
|---|---|---|
| roi-critic | ROI ("show me the money") | Vague benefits, hidden pricing, missing timeline |
| emotional-onboarding | Emotional + Onboarding | Trust/delight/anxiety arc + first-value ≤60s, ≤5 steps |
| content-layout-expert | Content vs Personas | Per-persona content audit, copy direction, ordering |

### Sequencing Rule
Wave 1 MUST complete before Wave 2 starts. Within a wave, all 3 critics run in parallel.

## Critic Output Format
Each critic writes their concerns to a structured file:

```markdown
# [Critic Name] — Concern List
Date: [YYYY-MM-DD]
Input: [stage3-draft path]

## Concerns

| # | Severity | Section | Concern | Proposed Fix | Persona Impact |
|---|----------|---------|---------|--------------|----------------|
| 1 | CRITICAL | Hero | ... | ... | Technical |
| 2 | HIGH | Pricing | ... | ... | ROI |
| ... | ... | ... | ... | ... | ... |

## Summary
- CRITICAL: [count]
- HIGH: [count]
- MEDIUM: [count]
- LOW: [count]
```

### Output Location
Each critic writes to: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-[critic-name]-concerns.md`

## 14-Dimension Audit Reference (from Bencium)
Critics should evaluate the draft across these dimensions (each critic focuses on their persona's priorities):

1. Visual Hierarchy — does the eye land where intended?
2. Spacing & Rhythm — consistent, intentional whitespace?
3. Typography — clear hierarchy, readable?
4. Color — restraint, guiding attention, accessible contrast?
5. Alignment & Grid — consistent?
6. Components — identical styling, all states covered?
7. Iconography — consistent style, weight, size?
8. Motion — natural, purposeful, performant?
9. Empty States — intentional or broken appearance?
10. Loading States — consistent skeletons/spinners?
11. Error States — styled, helpful, non-hostile?
12. Dark Mode — designed or just inverted?
13. Density — can anything be removed?
14. Responsiveness — every viewport, touch targets, fluid?

Not every critic audits all 14. Each focuses on what their persona cares about:
- technical-critic: 1, 3, 5, 6, 7, 14
- sceptical-critic: 1, 3, 4, 9, 11
- time-to-think-critic: 1, 8, 9, 10, 13
- roi-critic: 1, 3, 13
- emotional-onboarding: 4, 8, 9, 10, 11
- content-layout-expert: 1, 2, 3, 12, 13

## Reduction Filter (from Bencium)
After listing concerns, each critic applies 4 questions to their own proposals:
1. Can this be removed without losing meaning? → Remove it
2. Would a user need instruction to discover this? → Redesign until obvious
3. Does this feel inevitable? → If not, incomplete
4. Is visual weight proportional to functional importance? → Fix if not

## Cross-Critic Coordination
- If your concern overlaps with another critic's domain, cross-reference it
- Example: "Also relevant to sceptical-critic: social proof gap"
- Do NOT suppress a valid concern to avoid duplication
- Conflicts between critics are NOT resolved here — they go to Stage 5

## Rules
- Critics produce concern lists, NOT rewrites or implementation
- content-layout-expert may propose "copy direction" and "catch-phrases" but NOT finished copy
- emotional-onboarding may FLAG concerns about color/font emotional fit but does NOT veto — escalates to Stage 5
- All severity rankings use: CRITICAL / HIGH / MEDIUM / LOW (definitions in ux-architect command)
