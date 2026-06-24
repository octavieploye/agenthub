# Kanban Board

The Kanban board is the task-tracking layer inside AgentHub.

## Opening the Board

Click the **Kanban** icon in the sidebar. The board opens in its own window and updates live.

## Columns

| Column | Meaning |
|--------|---------|
| **Backlog** | Not yet started — default for new tasks |
| **Today** | What you intend to work on today |
| **In Progress** | Actively being worked |
| **Done** | Code complete |
| **Tested** | Verified and passing |
| **Interrupted** | Stopped mid-way — needs attention |

Collapse a column by clicking its header. Drag cards between columns.

## Creating a Task

Click **+ Add task** at the bottom of any column. Fill in:

- **Title** — imperative verb, under 80 chars (e.g. `Add JWT auth`)
- **Category** — `backend`, `frontend`, `database`, `schema`, `functionality`, or custom
- **Priority** — High / Medium / Low (defaults to Low)
- **Note** — private context, file paths, reminders

Press **Enter** to add or **Escape** to cancel.

## Editing a Card

**Hover → ✏** — inline edit for title, category, note.

**Hover for ~0.65s** — detail popover slides in. Exposes all fields: Title, Description, Priority, Status, Agent, Project, Category, Note, Epic, Sprint, Target Date. Click **Save** or press **Enter**.

**Click priority badge** — cycles High → Medium → Low without opening the popover.

**Hover → ✕** — delete. Click twice to confirm. No undo.

## Filtering

Use the **Project** and **Agent** dropdowns in the Kanban header to show only relevant cards.

## Task Title Tips

- Imperative verb first: `Add`, `Fix`, `Refactor`, `Write`, `Remove`
- Under 80 characters
- Enough context without opening the card: `Fix login redirect after OAuth` not `Fix bug`

## Descriptions

- 1–3 sentences max
- Focus on *how*: `Update JWT middleware in src/auth/guard.ts to check token expiry before forwarding`
- If dispatching to an agent, the description lands in the prompt — write it as instructions
