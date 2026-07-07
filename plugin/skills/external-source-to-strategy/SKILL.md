---
name: external-source-to-strategy
description: Use when the user shares a transcript, article, video summary, or any external content and asks to extract learnings, compare against the project, or create a competitive brief
category: business-analysis
---

# External Source to Strategy

Turn any external source (transcript, article, panel, framework) into a competitive brief, priority-ordered todos, and a saved memory reference — all linked and scoped to AgentHub and Optimaeus.

## When to Use

- User pastes a transcript or summarised content from a talk, podcast, video, or article
- User says "review this and tell me what we can learn" or "add this as a competitor brief"
- User shares a framework (business, technical, product) and wants it applied to the project
- User asks for improvements, learnings, or a strategic brief based on external content

## Workflow

```
Read source
    ↓
Identify: key frameworks, speakers, products, or companies
    ↓
Read memory + entity files for current project state
    ↓
Compare: where do we succeed? where do we fail?
    ↓
Prioritize improvements (P0 → P3)
    ↓
Write brainstorm doc  ──→  docs/brainstorm/<slug>.md
Write todo file       ──→  docs/todo-business/<slug>.md  (linked to brainstorm doc)
Save memory reference ──→  memory/reference_<slug>.md
Update MEMORY.md index
```

## Step 1 — Read the Source

Extract:
- Who is speaking / what company / what product
- The core framework or argument (1-3 sentences max)
- Key claims with concrete examples or data points
- Any direct comparisons or market context

## Step 2 — Load Project State

Before analyzing, read:
- `MEMORY.md` index for current project status
- Relevant memory files (project strategy, architecture, completed sprints)
- Entity definitions if comparing against Optimaeus system entities

Never analyze in a vacuum. The comparison must be grounded in what the project actually is today.

## Step 3 — Compete and Compare

For each key concept in the source, answer two questions:

| Question | Output |
|---|---|
| Where does AgentHub/Optimaeus already do this or do it better? | "Where we succeed" section |
| Where does AgentHub/Optimaeus fall short or not address this at all? | "Where we fail" section |

Be specific. Name the exact gap (e.g., "no structured output renderer") not the abstract category (e.g., "UI is weak").

## Step 4 — Prioritize Improvements

Assign priority to each identified gap:

| Label | Meaning |
|---|---|
| P0 | Blocks everything else or is a critical missing table stake — do before next sprint |
| P1 | High impact, achievable within current stack — do this month |
| P2 | Important but requires new infrastructure or design — plan for next quarter |
| P3 | Exploratory or dependent on P0-P2 being done first |

Each improvement must include: what to do, how to approach it (tool/strategy), and why this priority.

## Step 5 — Write the Brainstorm Doc

File: `docs/brainstorm/<descriptive-slug>.md`

Structure:
```
# [Title]
## Source: [what it is]
## Date: [YYYY-MM-DD]

---

## [Competitors / Frameworks] Analyzed
[summary table: who | what layer | core claim]

## What Each [Competitor/Framework] Is Solving
[one section per key entity from the source]

## Where We Succeed
[specific advantages, with named mechanisms — not just "we're good at X"]

## Where We Fail
[specific gaps, with named symptoms — not just "we're weak at Y"]

## Priority Improvements (P0–P3)
[ordered list with approach and rationale per item]

## Competitive Position Summary
[table: dimension | competitor A | competitor B | AgentHub | Optimaeus]
```

## Step 6 — Write the Todo File

File: `docs/todo-business/<same-slug>.md`

Structure:
```
# [Topic] — Todo
## Source: docs/brainstorm/<same-slug>.md
## Last updated: [YYYY-MM-DD]

---

## Context Summary
[2-3 sentence digest linking to brainstorm doc]

## P0 — Do These Before Any Next Sprint
- [ ] [specific, actionable item]
- [ ] [specific, actionable item]

## P1 — Do These This Month
- [ ] ...

## P2 — Plan for Next Quarter
- [ ] ...

## P3 — When P0-P2 Are Done
- [ ] ...

## Constraints to Never Violate
[what NOT to do, relevant to this domain]

---

## Notes
Full analysis: docs/brainstorm/<slug>.md
```

## Step 7 — Save Memory Reference

File: `memory/reference_<slug>.md` (frontmatter type: `reference`)

Include:
- One-line source description
- Where we succeed (3-5 bullets)
- Where we fail (3-5 bullets)
- Priority actions (P0 and P1 only — full list is in the todo file)
- Path to the brainstorm doc and todo file

Then add a one-line entry to `MEMORY.md` under the relevant section:
```
- [Title](reference_<slug>.md) — [10-word hook describing key finding]
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Analyzing without reading current project state first | Always load MEMORY.md + relevant entity files before comparing |
| Writing "we're behind on GenUI" without naming the exact gap | Name the specific missing piece: "no structured output renderer in agent panel" |
| Creating the brainstorm doc but not the todo file | Both always created together — the todo is what makes the analysis actionable |
| Priorities not grounded in the current stack | P0 must be achievable with what exists today; P2/P3 for new infra |
| Generic improvements that apply to any product | Every item must be specifically scoped to AgentHub or a named Optimaeus entity |
| Memory reference that duplicates the full doc | Memory = index and hook, not full content. Full content lives in the brainstorm doc |

## File Naming

Use a short, descriptive slug that survives across conversations:
- Source type first if helpful: `hormozi-supply-demand`, `generative-ui-competitive`
- Avoid dates in filename (date goes in doc frontmatter)
- Same slug used for all three outputs: brainstorm doc, todo file, memory reference
