# Workspace Memory

Workspace Memory gives each project a persistent context layer automatically injected into every agent spawn.

## Three Memory Layers

- **Layer 0 — Context Doc**: A document you write describing the project (tech stack, conventions, goals). Injected verbatim at the top of every agent's context.
- **Layer 1 — Session SBARs**: The last few session summaries auto-generated when agents complete tasks. Injected automatically.
- **Layer 2 — Pinned Learnings**: Specific insights you pin manually — they persist across all future agents on this project.

All three layers combine into `<project-path>/.claude/workspace_memory.md` before every agent spawn.

## Setup

1. Open **Projects** (Kanban toolbar → three-dot menu → Manage Projects)
2. Find your project and click **Edit**
3. Enter the **Project Path** (absolute path to the project folder)
4. Enter your **Context Doc** — tech stack, conventions, constraints
5. Click **Save**

## Pinning a Learning

When a Kanban card reaches **Completed**, hover it — a **📌** button appears. Click to pin the card's title as a learning for the project.

## Viewing Pinned Learnings

Open **Projects** → find your project → click **Memory**. A panel shows all pinned learnings with an **✕** to remove any, plus a text area to pin new ones manually.
