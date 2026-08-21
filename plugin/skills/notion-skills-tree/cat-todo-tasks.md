# Category: Todos & Tasks

Managing Future/Present/Now todos and separating human tasks from agent tasks.

## When to load

- After any task completion that generates new todos
- When organizing the task board
- When notion-memory entries contain `todos` or `human_tasks`

## Todo Structure

Three priority levels in each project's Todos section:

| Priority | Label | Meaning |
|---|---|---|
| Urgent | **Now** | Actively being worked on or blocking other work |
| Planned | **Next** | Scheduled, has a clear scope, not yet started |
| Backlog | **Future** | Ideas, nice-to-haves, deferred items |

Plus a **Done** column for completed items (keep last 20, archive older).

## Human Tasks vs Agent Tasks

Separate these clearly. They have different audiences.

**Human tasks** = things only the user can do:
- Create accounts (OVH, Coolify, Better Auth dashboard)
- Sign contracts or agreements
- Configure DNS, domain settings
- Make financial decisions (pricing, budget approval)
- Physical actions (hardware setup)

**Agent tasks** = things agents can handle:
- Code changes, refactoring
- Research and analysis
- Documentation updates
- Test writing and execution

## Format in Notion

Use a database with these columns:

| Column | Type | Values |
|---|---|---|
| Task | Title | Description of the task |
| Status | Select | Now / Next / Future / Done |
| Type | Select | Human / Agent |
| Project | Select | Which project this belongs to |
| Source | Text | Where this came from (sprint, research, etc.) |
| Date added | Date | When the task was created |

## Rules

- Never mark a human task as Done — only the user can do that
- Agent tasks can be marked Done when verified complete
- When moving items between priorities, follow modification protocol
