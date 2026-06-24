# Workspace Memory

Workspace Memory gives each project a persistent context layer that is automatically injected into every agent spawn. Agents always start with relevant project knowledge — no manual copy-pasting.

## How it works

Each project has three memory layers:

- **Layer 0 — Context Doc**: A free-form document you write to describe the project (tech stack, conventions, goals). Injected verbatim at the top of every agent's context.
- **Layer 1 — Session SBARs**: The last few session summaries (SBAR reports) auto-generated when agents complete tasks. Injected automatically — no action needed.
- **Layer 2 — Pinned Learnings**: Specific insights you pin manually so they persist across all future agents on this project.

All three layers are combined into a `workspace_memory.md` file written to `<project-path>/.claude/workspace_memory.md` before every agent spawn.

## Setting up your project path and context doc

1. Open **Projects** (kanban toolbar → three-dot menu → Manage Projects).
2. Find your project row and click **Edit**.
3. Enter the **Project Path** — the absolute path to the project folder (e.g. `/Users/you/repos/my-project`). This tells AgentHub where to write the memory file.
4. Enter your **Context Doc** — a multi-line description of the project. Plain text or Markdown both work. Include tech stack, coding conventions, important constraints, and anything an agent should know before starting.
5. Click **Save**.

## Pinning learnings from a completed card

When a Kanban card reaches **Completed** status:

1. Hover over the card — a **📌** pin button appears in the footer.
2. Click it to pin the card's title (and note, if present) as a learning for the project.
3. The button briefly shows **✓ Pinned!** to confirm.

The pinned text is stored immediately and injected into all future agents on that project.

## Viewing and managing pinned learnings

1. Open **Projects** → find your project row.
2. Click the **Memory** button.
3. A panel expands showing:
   - A read-only note that Layer 1 SBARs are auto-included.
   - All current **Pinned Learnings** with an **✕** button to remove any entry.
   - A text area at the bottom to **Pin** a new learning manually.

## Changing or deleting a project path

- If you change a project's path, the old `workspace_memory.md` at the previous path is deleted automatically. A fresh one is written at the new path on the next agent spawn.
- If you delete a project, its `workspace_memory.md` is also deleted, and all pinned learnings are removed from the database.
