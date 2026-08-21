# Universal Design Principles — UX Challenge Workflow

Authoritative reference for all agents in the UX Challenge pipeline.
Merged from 5 external skill sources: Taste, Anthropic, Bencium, UI/UX Pro Max, Content Layout.

---

## 1. Brief-First Rule

Every design decision must be traceable to the brief's audience, vibe, brand, and constraints. A design choice that cannot explain why it exists is slop. No element survives without a brief-backed reason.

---

## 2. Anti-AI-Slop Ban List

### Banned Fonts (as primary)
Inter, Roboto, Arial, Open Sans, Lato, Helvetica, system fonts, Space Grotesk (second-order convergence — AI avoids first defaults but clusters here).

### Banned Font Defaults
Fraunces, Instrument Serif — acceptable ONLY when the brief explicitly demands them. Never as a default choice.

### Banned Colors
- Generic SaaS blue (#3B82F6)
- AI-purple/pink gradients
- Beige + brass + oxblood palette (#f5f1ea / #b08947 / #9a2436)
- Warm cream (#F4F1EA) + terracotta as default

### Banned Layouts
- Three equal feature cards
- Split-header (left headline + right explainer)
- Section-numbering eyebrows ("001 Capabilities")
- Stats hero (big number + small label + gradient)

### Banned Copy
- Em-dashes anywhere on page (the #1 LLM tell)
- Filler verbs: Elevate, Seamless, Unleash, Next-Gen, Revolutionize
- "Quietly in use at"
- Scroll-cue text
- Jane Doe / Acme placeholders
- "Elevate your workflow" style sentences

### Banned Patterns
- Scattered micro-interactions (one orchestrated moment beats many small ones)
- Numbered markers on non-sequential content
- Custom mouse cursors
- Placeholder-as-label forms
- Pure black (#000000)

---

## 3. Priority Hierarchy

When principles conflict, this order decides:

| Priority | Domain | Severity |
|---|---|---|
| 1 | Accessibility | CRITICAL |
| 2 | Touch & Interaction | CRITICAL |
| 3 | Performance | HIGH |
| 4 | Style Selection | HIGH |
| 5 | Layout & Responsive | HIGH |
| 6 | Typography & Color | MEDIUM |
| 7 | Animation | MEDIUM |
| 8 | Forms & Feedback | MEDIUM |
| 9 | Navigation Patterns | HIGH |
| 10 | Charts & Data | LOW |

---

## 4. Quality Floor (non-negotiable baseline)

These are always flagged. The user decides implementation, but no deliverable ships without these being addressed:

- WCAG 2.1 AA contrast: 4.5:1 normal text, 3:1 large text, 3:1 UI components
- Touch targets >= 44x44px
- Keyboard navigation on all interactive elements
- `prefers-reduced-motion` respected
- Responsive down to 375px
- Visible focus indicators

---

## 5. Design Uniqueness Test

For every design element, ask: "Would I produce this for a different brief on a similar topic?"

If yes, revise that element. State what changed and why.

---

## 6. Anti-Template Rule

- Never use the same component library for all sections
- Mix 2-3 libraries per project
- Customize 3+ visual properties per library usage
- Match library to section purpose (not convenience)

---

## 7. Copy-as-Design-Material

Writing is design material, not decoration. Every visible string must:

- Help the user navigate
- Use naming from the user's side, not the system's
- Each label does exactly one job
- Active voice on controls ("Save changes" not "Submit")
- Sentence case, no filler, conversational register

---

## 8. Image Strategy

Priority order:
1. Generated images (AI or custom)
2. Real web images (picsum.photos with descriptive seeds)
3. Explicit placeholder slots with clear dimensions and content description

NEVER use:
- div-based fake screenshots
- Hand-rolled SVGs pretending to be content
- Pure-text minimalism where imagery is expected

---

## 9. Output Standards

All deliverables must be:
- **Scannable** — headers, bullets, tables (no walls of text)
- **Actionable** — clear next steps for every recommendation
- **Source-cited** — 2+ independent sources for any factual claim
- **User-ready** — no internal jargon, no agent-facing shorthand
