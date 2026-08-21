# Phase 3 — Animation & Interaction Patterns

**Agent:** animation-engineer
**Trigger:** Activated by lead-design-research after Trend Harvest Report is complete (can run parallel to Phase 2)
**Input:** Trend Harvest Report + target context
**Output:** Animation & Interaction Spec

## Objective

Document current animation and interaction patterns for software landing pages, focusing on Tailwind CSS utilities, scroll-triggered reveals, and event-triggered transitions. All patterns must include performance assessments.

## Research Protocol

1. **Review Trend Harvest Report** — identify which visual patterns require animation/interaction support
2. **Check Tailwind CSS docs** — verify class names and plugin requirements against the official docs
3. **Check DaisyUI docs** — identify animation patterns available in the existing component library
4. **Research interaction patterns** — use WebSearch for scroll-triggered and micro-interaction examples (5-round limit)
5. **Produce Spec** — document all patterns with trigger, classes, JS requirement, performance note

## Pattern Categories

### Category 1: Tailwind Native (no JS)

Patterns achievable with pure Tailwind CSS:
- `transition`, `duration-*`, `ease-*`, `delay-*` for state transitions
- `animate-spin`, `animate-ping`, `animate-pulse`, `animate-bounce`
- `hover:`, `focus:`, `active:`, `group-hover:` variants
- `motion-safe:`, `motion-reduce:` media query variants

### Category 2: Scroll-Triggered (Tailwind + JS)

Intersection Observer patterns:
- Fade-in-up on scroll enter (add class on intersection)
- Staggered reveal (delay increments across children)
- Count-up number animations (triggered at scroll position)
- Sticky section transitions

Implementation note: document the class toggle pattern, not the full React component.

### Category 3: Page Entry Animations

Above-the-fold entry sequences:
- Hero headline word-by-word reveal
- Logo/icon fade sequence
- CTA button pulse-on-load
- Background particle or gradient animation

### Category 4: Micro-Interactions

Small, precise feedback animations:
- Button press (scale-95 on active)
- Form field focus ring animation
- Checkbox check animation
- Toast/notification slide-in
- Skeleton screen pulse
- Loading spinner variants
- Success state (checkmark draw)

### Category 5: Navigation Interactions

- Mobile menu slide / fade
- Dropdown hover with subtle scale
- Active link indicator animation
- Scroll progress bar

## Performance Rules (non-negotiable)

Document with every pattern:

| Risk Level | Rule |
|---|---|
| Safe | `transform`, `opacity` only — no layout reflow |
| Use sparingly | `width`, `height` changes — triggers layout |
| Avoid | `top`, `left`, `margin`, `padding` animation — CLS risk |
| Always | Add `will-change: transform` for heavy animations |
| Always | Include `motion-reduce:` variant for accessibility |

## Output Format

Produce the Animation & Interaction Spec. Deliver to lead-design-research upon completion.
