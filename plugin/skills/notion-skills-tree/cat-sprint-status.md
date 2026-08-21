# Category: Sprint & Status

Sprint reports, deployment status, and progress updates.

## When to load

- After a sprint completes
- After a deployment
- When updating project progress

## Sprint Report Format

Each sprint entry in the Sprint Log toggle list:

```
Sprint [name/number] — [date]
Status: done | partial | blocked

What changed:
- [bullet list of changes, CEO-readable]

Key decisions:
- [any architectural or business decisions made]

Deployment:
- [dev/staging/prod status after this sprint]

Open items:
- [remaining todos carried to next sprint]
```

## Deployment Status

Update the Deployment Status section of the project page:

| Environment | Status | Last deployed | Notes |
|---|---|---|---|
| Development | active/inactive | date | |
| Staging | active/inactive | date | |
| Production | active/inactive | date | |

## Progress Tracking

When updating progress:
1. Check notion-memory entries for the repo
2. Cross-reference with git log to verify claims
3. Update the Sprint Log with a new entry
4. Update Deployment Status if deployment occurred
5. Move completed todos from Now → Done
6. Add new todos from notion-memory entries
