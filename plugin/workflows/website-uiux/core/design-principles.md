# Website UI/UX — Design Principles

## Universal Rules

1. **NEVER assume** — If anything is unclear, ambiguous, or missing — stop and ask
2. **NEVER take decisions without user approval** — Propose, wait, act only after explicit confirmation
3. **USER IS THE SOURCE OF TRUTH** — User knowledge overrides all .md files and AI training
4. **NEVER state external facts with confidence** — Express uncertainty, defer to user
5. **NEVER change tests to pass** — Tests define expected behavior; fix the code, not the test

## Website-Specific Principles

### 1. Non-Tech User First

Every design decision must pass the "Alex Test":
- Alex is 48 years old
- Alex is AI-curious but not technical
- Alex wants value with minimal friction
- Alex is fluent with smartphones but not developer tools

**Questions to ask for every design:**
- Can Alex understand the primary action within 3 seconds?
- Are all labels understandable without tooltips?
- Is there any jargon visible to users?
- Does the flow feel intuitive or does it require learning?
- What would make Alex close the tab in the first 10 seconds?

### 2. One Primary Action Per View

- Reduce choice paralysis
- Every page should have ONE clear goal
- Secondary actions are visually de-emphasized
- Progressive disclosure for advanced options

### 3. Status Always Visible

- Agents communicate state through color + label
- Never rely on subtle indicators alone
- Loading states must explain what's happening
- Error states must provide recovery path

### 4. Zero-Config Defaults

- Every feature works out of the box
- No setup required for basic functionality
- Advanced options hidden until needed

### 5. Plain Language

- Avoid developer terms in UI copy
- No "spawn", "IPC", "agent terminal"
- Use "you" and "your" for direct address
- Write at 8th-grade reading level for mass market

### 6. Accessibility Advisory (Not Blocking)

- WCAG 2.1 AA guidelines are advisory
- Some accessibility features can be counter-productive for specific use cases
- Flag issues with severity (CRITICAL/HIGH/MEDIUM/LOW)
- Let user decide which to implement

### 7. Anti-Template

- Never use the same library for all sections
- Mix at least 2-3 component libraries per project
- Customize at least 3 visual properties
- Match library to section purpose (marketing ≠ app ≠ admin)

## Concurrency Rules

- Maximum 3 agents active at once
- Phase 1 Research: competitor-trend-researcher + emotion-ux + persona-nontechuser (3 active)
- Phase 2 UX: ux-architect + animation-engineer (2 active) + persona-nontechuser (1 active)
- Phase 3 Implementation: dev-frontend + animation-engineer (2 active)
- Phase 4 Handoff: lead-ui-ux-website (1 active)

## Output Standards

All deliverables must be:
- **Scannable** — Use headers, bullets, tables
- **Actionable** — Clear next steps, no vague recommendations
- **Source-cited** — 2+ independent sources for claims
- **User-ready** — Presentable to end user without editing
