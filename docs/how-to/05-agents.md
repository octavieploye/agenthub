# Agents

Agents are Claude CLI sessions managed by AgentHub. Run multiple simultaneously across different repos.

## Spawning an Agent

Click **+ New Agent** in the sidebar. Fill in name, repo, task description, and model. The agent appears in the sidebar and its terminal becomes active immediately.

## Dispatching a Task

Hover a Kanban card → click **⚡**. The Dispatch Modal opens:

1. Choose to spawn a new agent or use an existing one
2. Edit the auto-built prompt if needed
3. Optionally add sub-agents (`dev-backend`, `dev-frontend`, `dev-integration`)
4. Click **Dispatch** — the agent spawns and the task moves to In Progress

## Breakout Terminals

Click **⤢** on an agent card to open a full-screen terminal for that agent. Close it to return to the main window.

## Agent Status

| Status | Meaning |
|--------|---------|
| `spawning` | Starting the Claude CLI session |
| `busy` | Generating a response |
| `idle` | Waiting for input |
| `awaiting_approval` | Paused — needs your permission |
| `completed` | Session ended normally |
| `interrupted` | Session ended unexpectedly |

## Code Blue — Emergency Stop

Press **Code Blue** (red button in SABar) to immediately pause all active agents. Resume agents individually from their cards.

## When a Session Ends

An agent's terminal stays on screen after the agent finishes, so you can still read
everything it did. The session itself is over, though — there is no longer a program
listening on the other side.

You will see:

- A line in the terminal: `── session ended — input is no longer delivered. Respawn to continue. ──`
- The prompt field greyed out, reading **Session ended — respawn to continue**
- The **Send** button replaced by a **Respawn** button

Click **Respawn** to start a fresh session for that agent. The prompt field and voice
input become usable again, and the terminal history stays where it is.

If you type into an ended session nothing happens — that is expected, not a freeze.
Respawn first, then send your prompt.
