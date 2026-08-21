# Stage 5 — Convergence

**Agent:** lead-ux-challenge
**Active agents:** 1
**Prerequisite:** Stage 4 Wave 1 + Wave 2 complete (all 6 concern lists available)

## Purpose
Resolve all critic concerns into a single converged design. Apply least-friction tie-break. Escalate genuinely-equal trade-offs to the user. Produce the converged design document.

## Input
6 concern lists from Stage 4:
- docs/ux-challenge/[date]-[slug]-technical-critic-concerns.md
- docs/ux-challenge/[date]-[slug]-sceptical-critic-concerns.md
- docs/ux-challenge/[date]-[slug]-time-to-think-critic-concerns.md
- docs/ux-challenge/[date]-[slug]-roi-critic-concerns.md
- docs/ux-challenge/[date]-[slug]-emotional-onboarding-concerns.md
- docs/ux-challenge/[date]-[slug]-content-layout-expert-concerns.md

## Convergence Process

### Step 1 — Triage by Severity (from Bencium 3-phase model)
Sort ALL concerns from all 6 critics into three phases:
- **Phase 1 (Critical)** — actively harms UX, blocks core functionality, legal risk → MUST resolve
- **Phase 2 (Refinement)** — elevates experience, significant barrier for some users → SHOULD resolve
- **Phase 3 (Polish)** — subtle details, minor inconvenience → MAY resolve

### Step 2 — Conflict Detection
Identify concerns that contradict each other:
- Critic A says "add more detail" vs Critic B says "reduce density"
- Critic A says "add urgency CTA" vs Critic B says "remove pressure"
Mark each conflict with both sides stated.

### Step 3 — Least-Friction Tie-Break
For each conflict, apply the least-friction rule:
> "Which resolution produces less friction for the most users?"

Friction is measured by:
- Steps added to reach primary action
- Cognitive load increase (more choices, more reading)
- Accessibility degradation
- Bounce risk (first 10 seconds)

The option that adds LESS friction wins. Document the reasoning.

### Step 4 — Priority Hierarchy (from UI/UX Pro Max)
When least-friction does not resolve (both options add equal friction):
1. Accessibility (CRITICAL) > Style (HIGH) > Animation (MEDIUM)
2. must_have constraints > if_X conditionals
3. CRITICAL severity > HIGH > MEDIUM > LOW

### Step 5 — User Escalation
Genuinely-equal trade-offs that cannot be resolved by least-friction OR priority hierarchy are escalated to the user:
- Present both options with pros/cons
- State why you cannot resolve it
- Wait for user decision
- NEVER self-resolve a genuinely-equal trade-off

## Quality Gates (applied after convergence)

### Gate 1 — Anthropic 4-Gate Process
1. Is the subject concrete and named?
2. Does the token system exist (color, type, layout, signature element)?
3. For each element: "Would I produce this for a different brief?" If yes → revise
4. Is there exactly one signature element?

### Gate 2 — Apple Eight Principles Test
Every feature must satisfy: Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight

### Gate 3 — Bencium Reduction Filter
For every element in the converged design:
1. Can this be removed without losing meaning? → Remove
2. Would a user need instruction to discover this? → Redesign
3. Does this feel inevitable? → If not, incomplete
4. Is visual weight proportional to functional importance? → Fix

### Gate 4 — Taste Pre-Flight Checklist
Mechanical verification (every item must pass):
- [ ] Brief inference declared, dial values explicit and reasoned
- [ ] ZERO em-dashes anywhere
- [ ] Color Consistency Lock — same accent across entire page
- [ ] Shape Consistency Lock — one corner-radius system (all sharp OR all soft OR all pill)
- [ ] Button and form WCAG AA contrast (4.5:1)
- [ ] Hero fits viewport (headline max 2 lines, subtext max 20 words, CTA visible)
- [ ] Eyebrow count ≤ ceil(sectionCount / 3)
- [ ] No duplicate CTA intent on same page
- [ ] At least 4 different layout families across 8 sections
- [ ] Copy self-audit: every visible string checked for grammatical errors, unclear referents, AI hallucination signatures
- [ ] Motion justified in one sentence per animation
- [ ] One design system per project (no mixing)
- [ ] Real images required (generated or photography, no div-based fakes)
- [ ] No banned fonts, colors, or patterns (see core/design-principles.md)
- [ ] prefers-reduced-motion honored if MOTION_INTENSITY > 3
- [ ] All interactive states implemented (loading, empty, error, success)

## Output
Converged design written to: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-converged-design.md`

Format:
1. Design Summary (one paragraph)
2. Layout Specification (section-by-section)
3. Interaction Specification (states, transitions, focus flow)
4. Component Mapping (which component library for each element)
5. Typography & Color System (tokens, pairings, palette)
6. Motion Language (duration, easing, signature animation)
7. Accessibility Checklist (accepted/rejected items with reasoning)
8. Friction Audit (steps to primary action, cognitive load score)
9. Copy Direction (per-section: headline direction, CTA labels, plain-language rewrites)
10. Resolved Concerns Log (what was resolved, how, by which rule)
11. User Decisions Log (what was escalated, what the user chose)
