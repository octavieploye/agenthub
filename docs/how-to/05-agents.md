# Agents

Agents are Claude CLI sessions managed by AgentHub. You can run multiple agents simultaneously across different repos.

## Spawning an Agent

Click **+ New Agent** in the sidebar or use the command palette. Fill in:

- **Name** — descriptive label (e.g. `auth-refactor`)
- **Repo** — which codebase this agent works in
- **Task description** — what the agent is doing (shown on the card)
- **Model** — Claude model to use

The agent appears in the sidebar and its terminal becomes active immediately.

## Dispatching a Task to an Agent

Hover a Kanban card → click **⚡**. The Dispatch Modal opens:

1. **Mode** — Spawn new agent or use existing
2. **Agent name** (spawn mode) — auto-generated, edit if needed
3. **Prompt** — auto-built from task fields; edit before sending
4. **Team spawn** (optional) — add sub-agents (`dev-backend`, `dev-frontend`, `dev-integration`)
5. Click **Dispatch** — agent spawns, receives the prompt, task moves to In Progress

## Breakout Terminals

Click the **⤢** icon on an agent card to open a full-screen breakout terminal for that agent. The breakout window tracks the same session. Close it to return focus to the main window.

## Agent Status

| Status | Meaning |
|--------|---------|
| `spawning` | Starting the Claude CLI session |
| `busy` | Agent is generating a response |
| `idle` | Waiting for input |
| `awaiting_approval` | Paused — needs your permission to proceed |
| `completed` | Session ended normally |
| `interrupted` | Session ended unexpectedly |

## Code Blue — Emergency Stop

Press **Code Blue** (or the red button in SABar) to immediately pause all active agents. Use it when an agent is doing something unexpected. Resume agents individually from their cards.

## Agent Concurrency

The default team limit is **3 active agents** at once (configured in `CLAUDE.md`). AgentHub warns you in the Dispatch Modal if adding an agent would exceed this limit.

## Assigning an Agent to a Kanban Task

Open the card popover → **Agent** dropdown → pick a live agent → **Save**. The card shows the agent's color dot and live status. Click the dot to jump to that agent's terminal.
