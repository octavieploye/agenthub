# Stage 6 — Implementation Plan

**Agent:** lead-ux-challenge
**Active agents:** 1
**Prerequisite:** Stage 5 converged design approved by user

## Purpose
Lock the technical stack and write the implementation plan that will be handed to /team-sprint-planner.

## Stack Selection
Based on the converged design, lock:
1. **Component libraries** — which libraries for which sections (shadcn/ui, Radix, Headless UI, etc.)
2. **CSS framework** — Tailwind, CSS Modules, or other
3. **Animation library** — Framer Motion, GSAP, CSS transitions (based on MOTION_INTENSITY dial)
4. **Font loading** — Google Fonts, self-hosted, variable fonts
5. **Image strategy** — generated, stock, placeholder approach

## Implementation Plan Format

### Section-by-Section Build Order
For each section in the converged design:
1. Section name and purpose
2. Component(s) needed
3. Library source
4. Responsive behavior (mobile → desktop)
5. Animation specification (if any)
6. Accessibility requirements
7. Dependencies on other sections

### Estimated Complexity
Per section: LOW (existing component, minor customization) / MEDIUM (component exists, significant customization) / HIGH (custom build required)

### Build Priority
Ordered by: above-the-fold first, then conversion-critical sections, then supporting sections.

## Rules
- The plan describes WHAT to build, not HOW to code it
- No code in this document — implementation belongs to dev-frontend
- Stack choices must be justified against the brief's constraints
- If the converged design requires a library not in the project, flag it explicitly

## Output
Implementation plan written to: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-plan.md`
