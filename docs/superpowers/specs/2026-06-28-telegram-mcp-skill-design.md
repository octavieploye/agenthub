# Telegram MCP Tool + Skill Design

**Date:** 2026-06-28
**Status:** Approved

## Problem

Telegram notifications from agents are incomplete. The current PTY scraping pipeline (cleanTextBuffer → filterTtsResponse → .slice(-120) → sidecar truncation) is fundamentally broken: buffers get cleared by TTS, filters strip useful content, and triple truncation reduces messages to ~120 chars.

## Solution

Agents compose and send their own Telegram messages directly via an MCP tool. No PTY scraping. The agent knows what it did — let it say so.

## Architecture

```
Agent (Claude CLI)
  → calls send_telegram MCP tool (stdio)
    → MCP server connects to Unix socket
      → Electron main process receives message
        → forwards to sidecar
          → sidecar sends to Telegram API
            → user's phone
```

## Component 1: MCP Server

**File:** `src/main/telegram-mcp-server/index.js`

Standalone Node.js script, no external dependencies. Spawned per-agent by Claude CLI via `--mcp-config`.

### Tool: `send_telegram`

**Parameters:**
- `message` (string, required) — composed message to send
- `format` (enum: `status` | `question` | `error`, default `status`) — determines message chrome (emoji prefix, buttons)

**Behavior:**
1. Reads `AGENTHUB_TELEGRAM_SOCK` env var for Unix socket path
2. Reads `AGENTHUB_AGENT_ID` and `AGENTHUB_AGENT_NAME` env vars for identity
3. Connects to Unix socket
4. Sends JSON: `{ agentId, agentName, message, format }`
5. Receives JSON: `{ ok: true }` or `{ ok: false, error: "..." }`
6. Returns result to Claude CLI
7. Disconnects

**MCP protocol:** Implements minimal MCP stdio spec — `initialize`, `tools/list`, `tools/call`. No resources, no prompts.

## Component 2: Unix Socket Server

**File:** `src/main/services/telegram-socket-server.ts`

Small server in the Electron main process.

**Socket path:** `/tmp/agenthub-telegram-<pid>.sock` (pid avoids collisions with multiple AgentHub instances)

**Lifecycle:**
- Starts when Telegram sidecar starts (token saved + first contact established)
- Stops when sidecar stops or app shuts down
- Cleans up socket file on stop

**Protocol:** One JSON message per connection (connect → write → read response → disconnect). No persistent connections.

**Handler:**
1. Parses incoming JSON `{ agentId, agentName, message, format }`
2. Validates: message is non-empty string, format is valid enum
3. Builds a `TelegramNotificationPayload` with type `agent_message`
4. Calls `sidecar.notify(payload)`
5. Responds `{ ok: true }`

## Component 3: Agent Spawn Wiring

**Changes to `agent-manager.ts`:**

### Add MCP config at spawn time

When the socket server is running (Telegram connected):
1. Write a temp MCP config to `/tmp/agenthub-mcp-<agentId>.json`:
```json
{
  "mcpServers": {
    "agenthub-telegram": {
      "command": "node",
      "args": ["/absolute/path/to/telegram-mcp-server/index.js"],
      "env": {
        "AGENTHUB_TELEGRAM_SOCK": "/tmp/agenthub-telegram-<pid>.sock",
        "AGENTHUB_AGENT_ID": "<agentId>",
        "AGENTHUB_AGENT_NAME": "<agentName>"
      }
    }
  }
}
```
2. Add `--mcp-config /tmp/agenthub-mcp-<agentId>.json` to the `claude` CLI command string
3. Clean up the temp config file in the agent exit handler

### Remove PTY scraping notification path

Remove lines 210-251 (the 3s delayed setTimeout that re-filters cleanTextBuffer and applies .slice(-120)). This includes:
- The `telegramSendTimer` setTimeout block
- The `freshProse` / `lastFilteredProse` fallback logic
- The `payload.summary = freshProse.slice(-120)` truncation

### Keep status-only fallback

The existing notification trigger (lines 145-209) stays but simplified:
- `awaiting_approval`: unchanged (task description + approve/deny buttons)
- `completed`, `failed`, `needs_input`: send a status-only notification with task description as summary — no prose extraction. If the agent called the MCP tool, the user already has the full message. If it didn't, they get a status ping.

## Component 4: Sidecar Changes

**File:** `src/main/telegram-sidecar/index.js`

### New payload type: `agent_message`

Add handling in `sendNotification()` for `type: 'agent_message'`:

```javascript
} else if (payload.type === 'agent_message') {
  const format = payload.format || 'status'
  const emoji = format === 'error' ? '\u274c'
    : format === 'question' ? '\ud83d\udcac'
    : '\u2705'
  const msg = payload.message.length > 4000
    ? payload.message.slice(0, 3997) + '\u2026'
    : payload.message
  text = `${emoji} ${payload.agentName}\n\n${msg}\n\nProject: ${payload.repo}`
  if (format === 'question') {
    replyMarkup = { force_reply: true, selective: true }
  }
}
```

Only the Telegram 4096-char API limit applies. No artificial truncation.

### Existing types simplified

- `completed`: summary = task description (no prose extraction)
- `failed`: summary = task description
- `needs_input`: question = task description
- `awaiting_approval`: unchanged

## Component 5: Skill

**File:** `.claude/commands/telegram-notify.md`

A reference document auto-discovered by Claude CLI from the project's commands directory.

### Content

Teaches agents:

**When to send:**
- Task completed — summarize what you did and the outcome
- Need user input — ask the question clearly
- Error/failure — explain what went wrong and what you tried
- Significant milestone mid-task — optional, only if user asked for updates

**How to compose:**
- Write for a phone screen — short paragraphs, no terminal formatting
- Lead with the outcome, then supporting details
- Code snippets are fine but keep them short (< 20 lines)
- Questions: be specific about what you need from the user

**Format selection:**
- `status` — completion, milestones, informational updates
- `question` — when you need user input to proceed
- `error` — failures, blockers, unrecoverable errors

**Don'ts:**
- Don't send every tool call or file read
- Don't send raw terminal output
- Don't send more than 2-3 messages per task unless updates were requested
- Don't duplicate status notifications (the system sends those automatically)

## What Gets Removed

- `telegram-response-filter.ts` — never needed (already reverted)
- PTY scraping block in `agent-manager.ts` lines 210-251
- `telegramSendTimer` field from `ManagedAgent` interface
- Debug logging block for cleanTextBuffer pipeline (lines 146-160) — no longer relevant to Telegram
- `lastFilteredProse` is no longer read by Telegram (still set by TTS for its own use)

## What Stays Unchanged

- TTS pipeline (cleanTextBuffer, lastFilteredProse, filterTtsResponse, TtsTrigger) — completely untouched
- Sidecar inbound: long-polling, command handling, access control, callback handlers
- Notification router and triage system
- HeadlessTerminalBuffer (stays for potential future use, just not for Telegram)

## Files Changed/Created

| File | Change |
|---|---|
| `src/main/telegram-mcp-server/index.js` | New — MCP stdio server |
| `src/main/services/telegram-socket-server.ts` | New — Unix socket server |
| `src/main/services/agent-manager.ts` | Add --mcp-config flag, remove PTY scraping block |
| `src/main/services/service-orchestrator.ts` | Wire socket server lifecycle to sidecar |
| `src/main/telegram-sidecar/index.js` | Add `agent_message` type, simplify existing types |
| `src/shared/types/telegram.types.ts` | Add `agent_message` to payload type union |
| `.claude/commands/telegram-notify.md` | New — skill teaching agents when/how to send |

## Testing

- Unit test for socket server: connect, send valid payload, get `{ ok: true }`
- Unit test for socket server: invalid payload returns `{ ok: false, error }`
- Unit test for MCP server: mock socket, verify tool call produces correct JSON
- Integration: spawn agent with --mcp-config, verify tool appears in tool list
- Manual: trigger agent completion, check Telegram receives agent-composed message
