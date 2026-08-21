# Modification Protocol — 5-Question Gate

No page, database, or block in Notion may be modified without answering ALL five questions below. This is non-negotiable.

## Before ANY modification

| # | Question | Must answer |
|---|---|---|
| 1 | **WHAT** to change? | Exact content, field, or structure being modified |
| 2 | **WHERE** to change it? | Page title, database name, block location |
| 3 | **WHY** change it? | Source of truth that triggered this (git commit, memory entry, code diff) |
| 4 | **WHEN** to change it? | Now (immediate) or queue (pending verification) |
| 5 | **HOW** to change it? | Append, replace section, update field, restructure |

## Rules

- **Append** is always safe — adding new content at the end of a page or section
- **Replace** requires all 5 questions answered AND a double-check against the source
- **Restructure** (moving content, changing hierarchy) requires all 5 questions AND the CEO communication check: "Does this make it easier or harder for a CEO to find and understand?"
- **Delete** requires explicit human approval — no exceptions

## Examples

### Good — append (no protocol needed beyond logging)
```
Adding sprint R7 summary to AgentHub project page.
Source: .llm/notion/agenthub-notion-memory.md entry dated 2026-08-08
```

### Good — modification with protocol
```
WHAT: Update stack summary — remove Clerk, add Better Auth
WHERE: Projects / Internal / Opeidos / Stack Summary section
WHY: git log shows Clerk SDK removed in commit abc123, Better Auth added in def456
WHEN: Now — change is deployed and verified
HOW: Replace the "Authentication" row in the stack table
```

### Bad — modification without protocol
```
"Updating the Opeidos page with new info"
→ REJECTED: What info? Where exactly? Why now? How?
```

## When in doubt

If you cannot answer all 5 questions → do NOT modify. Instead:
1. Log what you wanted to change and why
2. Summon the user with the unanswered questions
3. Wait for explicit confirmation
