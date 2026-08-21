# Stage 3 — Adversarial UX↔UI Brainstorm

**Agents:** ux-architect + ui-designer (adversarial pair)
**Active agents:** 2
**Prerequisite:** Stage 2 Tight Brief approved

## Purpose
Dynamic adversarial brainstorm between the UX (structure/accessibility) and UI (aesthetics/identity) halves. Produces a combined design draft through challenge and counter-challenge.

## Adversarial Protocol

### Round Structure
Each round follows this sequence:
1. **Proposer** puts forward their design position (UX proposal or UI proposal)
2. **Challenger** responds with written, severity-ranked objections from their domain
3. **Proposer** addresses each objection: ACCEPT (with revision) or REBUT (with reasoning)
4. Roles swap — the challenger becomes the proposer for their domain

### Objection Log Format
Every round MUST produce a structured objection log:

```
## Round [N] Objection Log

### UX → UI Objections (ux-architect challenging ui-designer)
- [CRITICAL/HIGH/MEDIUM/LOW] [objection text] → [ACCEPTED: revision | REBUTTED: reasoning]
- [CRITICAL/HIGH/MEDIUM/LOW] [objection text] → [ACCEPTED: revision | REBUTTED: reasoning]

### UI → UX Objections (ui-designer challenging ux-architect)
- [CRITICAL/HIGH/MEDIUM/LOW] [objection text] → [ACCEPTED: revision | REBUTTED: reasoning]
- [CRITICAL/HIGH/MEDIUM/LOW] [objection text] → [ACCEPTED: revision | REBUTTED: reasoning]
```

### Termination Criteria
The brainstorm terminates when EITHER:
1. **Objection log is empty** — neither agent has objections in their domain
2. **Stall detected** — Round N objections are identical to Round N-1 objections (same text, same severity)

Lead-ux-challenge monitors both conditions. If neither is met after 5 rounds, lead escalates to the user.

### Failure Modes
- **Premature agreement** — agreement without challenge is a failure mode. If Round 1 produces zero objections, lead must probe: "Is there genuinely nothing to challenge, or are you avoiding conflict?"
- **Infinite loop** — if objections keep changing but never resolve, lead intervenes after 5 rounds
- **Scope invasion** — ux-architect challenging aesthetics or ui-designer challenging accessibility. Each agent challenges ONLY in their domain.

## Scope Boundaries

### ux-architect challenges on:
- Accessibility violations (WCAG 2.1 AA)
- Confusing layout / unclear hierarchy
- Too many steps to primary action
- Jargon in labels
- Missing states (loading, error, empty)
- Cognitive overload

### ux-architect defers on:
- Typography choices (font family, weight, pairing)
- Color palette selection
- Motion/animation design
- Visual identity / brand expression

### ui-designer challenges on:
- Generic / flat / AI-looking design
- Templated visual language
- Missing visual identity
- Uninspired typography
- Bland color direction
- Decoration without meaning

### ui-designer defers on:
- Accessibility compliance
- Keyboard navigation flow
- Screen reader support
- Touch target sizing
- Cognitive load scoring

## Quality Bar

### Signature Element (from Anthropic Frontend Design)
Every design MUST have exactly one unique visual element that embodies the brief — the single memorable thing. Everything around it stays quiet and disciplined. "Spend your boldness in one place."

### Chanel Rule (from Anthropic)
After the brainstorm converges, remove one decorative element. "Before leaving the house, take a look in the mirror and remove one accessory."

### Force Variety Protocol (from Bencium)
Before the first round, ui-designer rolls variety across 5 dimensions to prevent convergence:
- Color temperature: warm or cool
- Layout direction: left / right / center / diagonal
- Type personality: geometric / humanist / serif / slab / display / mono
- Motion philosophy: minimal / choreographed / playful
- Density: generous or controlled
State the roll and justify against the brief. Override only if the roll contradicts the brief's constraints.

### Interaction Quality Bar (from Apple Design)
Every interaction in the design must satisfy:
1. Response feedback within the first frame of contact
2. Direct manipulation (1:1 tracking where applicable)
3. Interruptibility — user input always takes priority over animations
4. Velocity handoff — seamless gesture-to-animation transition
5. Spatial consistency — elements originate from their trigger

### Wayfinding Test (from Apple Design)
Every screen must answer 4 questions:
1. Where am I?
2. Where can I go?
3. What is there?
4. How do I get back?
If any answer is unclear, the screen fails.

### Eight Principles Test (from Apple Design)
Every feature must satisfy all eight:
1. Purpose — intentional, decided what NOT to build
2. Agency — user in control via choices, not forced paths; undo easy
3. Responsibility — acts in user's interest; privacy at right moment for minimum needed
4. Familiarity — metaphors honor physics; consistency allows prediction
5. Flexibility — spans contexts, devices, abilities
6. Simplicity — every element earns its place
7. Craft — every spacing and timing value deliberate and defensible
8. Delight — emerging naturally from the other seven, not bolted on

## Motion Specification

### Duration by Element Weight (from Bencium)
- Lightweight (icons, badges, chips): 150ms
- Standard (cards, panels, list items): 300ms
- Weighty (modals, page transitions): 500ms

### Easing Curves (from Bencium)
- Ease-out → entrances, appearing elements
- Ease-in → exits, disappearing elements
- Ease-in-out → state changes, transforms
- Spring (underdamped) → momentum-driven gestures only
- Linear → spinners, continuous loops only

### Spring Parameters (from Apple Design)
- Damping ratio 1.0 (critically damped) = default for all UI
- Damping < 1.0 (bouncy) = reserved for momentum-driven gestures (flicks, throws)
- Response time 0.3-0.4s for most interactions
- Settle time emerges from parameters — never prescribe fixed duration

### Performance Gate
Animate ONLY transform and opacity (GPU-accelerated). No layout-triggering properties. All interactions under 500ms. prefers-reduced-motion replaces slides with opacity fades.

## Output
Combined design draft: layout spec + visual proposal + interaction spec + component mapping + objection log (all rounds).

Written to: docs/ux-challenge/[YYYY-MM-DD]-[category-slug]-stage3-draft.md (intermediate artifact, consumed by Stage 4)
