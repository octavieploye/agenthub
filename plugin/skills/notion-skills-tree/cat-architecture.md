# Category: Architecture Decisions

Documenting significant technical decisions and stack changes.

## When to load

- After a major tech change (framework swap, new dependency, new service)
- After an architectural decision is made
- When notion-memory entries have `type: architecture`

## Architecture Decision Record (ADR) Format

Create a sub-page under the project's Architecture Decisions section:

```
# [Date] — [Decision Title]

## Context
What situation prompted this decision? (1-2 sentences)

## Decision
What was decided? (1 sentence)

## Rationale
Why this option over alternatives? (bullet list)

## Alternatives considered
- [Option A] — why rejected
- [Option B] — why rejected

## Impact
- Code: [files/modules affected]
- Dependencies: [added/removed]
- Migration: [required steps]
- Risk: [what could go wrong]

## Status
Implemented / In progress / Proposed
```

## Stack Change Protocol

When a technology is replaced (e.g., Clerk → Better Auth):
1. Create an ADR sub-page
2. Update the project's Stack Summary table (remove old, add new)
3. Check if the change affects the Commercial counterpart
4. Update Neuronal System entity if applicable

## Verification

Before writing an architecture decision to Notion:
1. Confirm the change exists in code (check imports, package.json)
2. Find the relevant git commits
3. Verify the old technology is actually removed (not just commented out)
