# Synthesis — Handoff Format

This document defines the structure of the converged design package that Stage 7 passes to /team-sprint-planner.

## Package Contents

### 1. Tight Brief (from Stage 2)
- Category, mode, audience, positioning
- Three Dials (locked values)
- Constraints and anti-references

### 2. Converged Design (from Stage 5)
- Layout specification (section-by-section)
- Interaction specification (states, transitions, focus)
- Component mapping (library → element)
- Typography & color system (tokens)
- Motion language (durations, easing, signature animation)
- Accessibility checklist (accepted/rejected)
- Friction audit (steps, cognitive load)
- Copy direction (per-section)

### 3. Implementation Plan (from Stage 6)
- Stack selection (locked)
- Section-by-section build order with complexity
- Build priority
- Dependencies

### 4. Metadata
- Date
- Category slug
- Mode (WEBSITE / APPLICATION)
- Dial values
- Resolved concern count (CRITICAL/HIGH/MEDIUM/LOW)
- User decision count

## How Sprint Planner Uses This Package
1. Read the tight brief for context
2. Read the converged design for the spec
3. Read the implementation plan for build order
4. Spawn team-dev-loop with the plan
5. Spawn frontend-design as aesthetic supervisor
6. Spawn frontend-wire-verifier to validate implementation matches spec

## File Naming Convention
All artifacts follow: `docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-[artifact-type].md`
