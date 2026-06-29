# Telegram MCP Tool + Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents compose and send their own Telegram messages directly via an MCP tool, replacing the broken PTY scraping pipeline.

**Architecture:** Standalone MCP stdio server spawned per-agent by Claude CLI. Communicates with Electron main process via Unix socket. Sidecar delivers messages to Telegram API. Skill teaches agents when/how to use the tool.

**Tech Stack:** Node.js stdlib (net, fs, readline), MCP stdio protocol (JSON-RPC over stdin/stdout), Unix domain sockets.

## Global Constraints

- No external dependencies — Node.js stdlib only for MCP server and socket server
- MCP server script must live in `src/main/` (never `resources/bin/` — gitignored)
- All tests via `npm test` (never `npx vitest` directly — native module mismatch)
- Agent identity passed via env vars, not command-line args
- Telegram API 4096 char limit per message — truncate at 4000 to leave room for escaping
- Do NOT modify TTS pipeline (cleanTextBuffer, lastFilteredProse, filterTtsResponse, TtsTrigger)

---

### Task 1: Add `agent_message` type to shared types and sidecar

**Files:**
- Modify: `src/shared/types/telegram.types.ts:10-20`
- Modify: `src/main/telegram-sidecar/index.js:385-442`

**Interfaces:**
- Consumes: nothing (foundational)
- Produces: `TelegramNotificationPayload` type with `agent_message` variant; sidecar `sendNotification()` handles it

- [ ] **Step 1: Update TelegramNotificationPayload type**

In `src/shared/types/telegram.types.ts`, add `agent_message` to the type union and add new fields:

```typescript
export interface TelegramNotificationPayload {
  type: 'completed' | 'failed' | 'awaiting_approval' | 'needs_input' | 'agent_message'
  agentId: string
  agentName: string
  repo: string
  summary: string
  proposedAction?: string
  question?: string
  message?: string          // agent_message only — the composed message
  format?: 'status' | 'question' | 'error'  // agent_message only
  requestId?: string
  timestamp: string
}
```

- [ ] **Step 2: Add agent_message handling in sidecar sendNotification()**

In `src/main/telegram-sidecar/index.js`, add a new `else if` block before the final `if (!text) return` line (before line 439):

```javascript
  } else if (payload.type === 'agent_message') {
    const format = payload.format || 'status'
    const emoji = format === 'error' ? '\u274c'
      : format === 'question' ? '\ud83d\udcac'
      : '\u2705'
    const msg = (payload.message || '').length > 4000
      ? (payload.message || '').slice(0, 3997) + '\u2026'
      : (payload.message || '')
    text = `${emoji} ${payload.agentName}\n\n${msg}\n\nProject: ${payload.repo}`
    if (text.length > 4000) text = text.slice(0, 3997) + '\u2026'
    if (format === 'question') {
      replyMarkup = { force_reply: true, selective: true }
    }
  }
```

- [ ] **Step 3: Simplify existing completed/failed/needs_input summaries**

In the same `sendNotification()` function, change the existing types to use task description only (no prose extraction):

For `completed` (line ~394): replace `payload.summary.length > 120` with `payload.summary.length > 200`. This is now just the task description, not extracted prose.

For `failed` (line ~401): replace `payload.summary.length > 100` with `payload.summary.length > 200`.

For `needs_input` (line ~432): replace `(payload.question || '').length > 300` with `(payload.question || '').length > 200`.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/telegram.types.ts src/main/telegram-sidecar/index.js
git commit -m "feat(telegram): add agent_message payload type and sidecar handler"
```

---

### Task 2: Build the Unix socket server

**Files:**
- Create: `src/main/services/telegram-socket-server.ts`
- Create: `src/main/services/telegram-socket-server.test.ts`

**Interfaces:**
- Consumes: `TelegramSidecarService.notify(payload)` from `telegram-sidecar-service.ts:127`
- Produces: `TelegramSocketServer` class with `start(sockPath): void`, `stop(): void`, `getSocketPath(): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/main/services/telegram-socket-server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramSocketServer } from './telegram-socket-server'
import * as net from 'net'
import * as fs from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

function sendToSocket(sockPath: string, data: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(sockPath, () => {
      client.write(JSON.stringify(data))
    })
    let buf = ''
    client.on('data', (chunk) => { buf += chunk.toString() })
    client.on('end', () => {
      try { resolve(JSON.parse(buf)) } catch (e) { reject(e) }
    })
    client.on('error', reject)
  })
}

describe('TelegramSocketServer', () => {
  let server: TelegramSocketServer
  let sockPath: string
  const mockNotify = vi.fn()

  beforeEach(() => {
    sockPath = join(tmpdir(), `test-telegram-${Date.now()}.sock`)
    server = new TelegramSocketServer({
      notify: mockNotify,
      logInfo: vi.fn(),
      logError: vi.fn(),
    })
  })

  afterEach(() => {
    server.stop()
    try { fs.unlinkSync(sockPath) } catch {}
  })

  it('accepts a valid agent_message and calls notify', async () => {
    server.start(sockPath)
    const res = await sendToSocket(sockPath, {
      agentId: 'agent-1',
      agentName: 'test-agent',
      repo: 'my-repo',
      message: 'Task completed successfully',
      format: 'status',
    })
    expect(res).toEqual({ ok: true })
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'agent_message',
      agentId: 'agent-1',
      message: 'Task completed successfully',
      format: 'status',
    }))
  })

  it('rejects payload with missing message', async () => {
    server.start(sockPath)
    const res = await sendToSocket(sockPath, {
      agentId: 'agent-1',
      agentName: 'test-agent',
      repo: 'my-repo',
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('message') })
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('returns socket path after start', () => {
    server.start(sockPath)
    expect(server.getSocketPath()).toBe(sockPath)
  })

  it('returns null socket path before start', () => {
    expect(server.getSocketPath()).toBeNull()
  })

  it('cleans up socket file on stop', () => {
    server.start(sockPath)
    server.stop()
    expect(fs.existsSync(sockPath)).toBe(false)
    expect(server.getSocketPath()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/main/services/telegram-socket-server.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the implementation**

Create `src/main/services/telegram-socket-server.ts`:

```typescript
import * as net from 'net'
import * as fs from 'fs'
import type { TelegramNotificationPayload } from '../../shared/types/telegram.types'

export interface TelegramSocketServerDeps {
  notify: (payload: TelegramNotificationPayload) => void
  logInfo: (msg: string, meta?: Record<string, unknown>) => void
  logError: (msg: string, meta?: Record<string, unknown>) => void
}

const VALID_FORMATS = ['status', 'question', 'error'] as const

export class TelegramSocketServer {
  private server: net.Server | null = null
  private sockPath: string | null = null
  private readonly deps: TelegramSocketServerDeps

  constructor(deps: TelegramSocketServerDeps) {
    this.deps = deps
  }

  start(sockPath: string): void {
    if (this.server) return
    // Clean up stale socket file from prior crash
    try { fs.unlinkSync(sockPath) } catch {}

    this.sockPath = sockPath
    this.server = net.createServer((conn) => {
      let buf = ''
      conn.on('data', (chunk) => { buf += chunk.toString() })
      conn.on('end', () => {
        try {
          const data = JSON.parse(buf)
          const result = this.handleMessage(data)
          conn.end(JSON.stringify(result))
        } catch (e) {
          conn.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
        }
      })
      conn.on('error', (err) => {
        this.deps.logError('telegram socket connection error', { error: String(err) })
      })
    })

    this.server.listen(sockPath, () => {
      this.deps.logInfo('telegram socket server listening', { sockPath })
    })

    this.server.on('error', (err) => {
      this.deps.logError('telegram socket server error', { error: String(err) })
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    if (this.sockPath) {
      try { fs.unlinkSync(this.sockPath) } catch {}
      this.sockPath = null
    }
  }

  getSocketPath(): string | null {
    return this.sockPath
  }

  private handleMessage(data: unknown): { ok: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Expected JSON object' }
    }
    const msg = data as Record<string, unknown>

    if (!msg.message || typeof msg.message !== 'string') {
      return { ok: false, error: 'Missing required field: message' }
    }
    if (!msg.agentId || typeof msg.agentId !== 'string') {
      return { ok: false, error: 'Missing required field: agentId' }
    }
    if (!msg.agentName || typeof msg.agentName !== 'string') {
      return { ok: false, error: 'Missing required field: agentName' }
    }

    const format = (typeof msg.format === 'string' && VALID_FORMATS.includes(msg.format as typeof VALID_FORMATS[number]))
      ? msg.format as 'status' | 'question' | 'error'
      : 'status'

    const payload: TelegramNotificationPayload = {
      type: 'agent_message',
      agentId: msg.agentId as string,
      agentName: msg.agentName as string,
      repo: (msg.repo as string) || '',
      summary: '',
      message: msg.message as string,
      format,
      timestamp: new Date().toISOString(),
    }

    this.deps.notify(payload)
    return { ok: true }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/main/services/telegram-socket-server.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/telegram-socket-server.ts src/main/services/telegram-socket-server.test.ts
git commit -m "feat(telegram): add Unix socket server for MCP-to-sidecar bridge"
```

---

### Task 3: Build the MCP stdio server

**Files:**
- Create: `src/main/telegram-mcp-server/index.js`

**Interfaces:**
- Consumes: Unix socket at path from `AGENTHUB_TELEGRAM_SOCK` env var (Task 2's server)
- Produces: MCP stdio server exposing `send_telegram` tool

- [ ] **Step 1: Create the MCP server**

Create `src/main/telegram-mcp-server/index.js`:

```javascript
// src/main/telegram-mcp-server/index.js
'use strict'

const net = require('net')
const readline = require('readline')

const SOCK_PATH = process.env.AGENTHUB_TELEGRAM_SOCK
const AGENT_ID = process.env.AGENTHUB_AGENT_ID || 'unknown'
const AGENT_NAME = process.env.AGENTHUB_AGENT_NAME || 'unknown'
const AGENT_REPO = process.env.AGENTHUB_AGENT_REPO || ''

// ── MCP JSON-RPC helpers ────────────────────────────────────────────────────
function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result })
  // MCP stdio uses Content-Length header framing
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
}

// ── Unix socket communication ───────────────────────────────────────────────
function sendToAgentHub(payload) {
  return new Promise((resolve, reject) => {
    if (!SOCK_PATH) {
      reject(new Error('AGENTHUB_TELEGRAM_SOCK not set — Telegram not connected'))
      return
    }
    const client = net.createConnection(SOCK_PATH, () => {
      client.write(JSON.stringify(payload))
      client.end()
    })
    let buf = ''
    client.on('data', (chunk) => { buf += chunk.toString() })
    client.on('end', () => {
      try { resolve(JSON.parse(buf)) } catch { reject(new Error('Bad response from AgentHub')) }
    })
    client.on('error', (err) => {
      reject(new Error(`Cannot connect to AgentHub: ${err.message}`))
    })
  })
}

// ── MCP method handlers ─────────────────────────────────────────────────────
const TOOL_DEF = {
  name: 'send_telegram',
  description: 'Send a message to the user via Telegram. Use this to report task completion, ask questions, or report errors. Write for a phone screen — short paragraphs, lead with the outcome.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to send. Plain text, no ANSI codes. Short code snippets OK.'
      },
      format: {
        type: 'string',
        enum: ['status', 'question', 'error'],
        description: 'Message type: status (completion/milestone), question (need user input), error (failure/blocker). Default: status',
        default: 'status'
      }
    },
    required: ['message']
  }
}

async function handleMethod(id, method, params) {
  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agenthub-telegram', version: '1.0.0' }
      })
      break

    case 'tools/list':
      sendResponse(id, { tools: [TOOL_DEF] })
      break

    case 'tools/call': {
      const toolName = params?.name
      const args = params?.arguments || {}

      if (toolName !== 'send_telegram') {
        sendError(id, -32602, `Unknown tool: ${toolName}`)
        return
      }

      if (!args.message || typeof args.message !== 'string') {
        sendResponse(id, {
          content: [{ type: 'text', text: 'Error: message is required and must be a string' }],
          isError: true
        })
        return
      }

      try {
        const result = await sendToAgentHub({
          agentId: AGENT_ID,
          agentName: AGENT_NAME,
          repo: AGENT_REPO,
          message: args.message,
          format: args.format || 'status'
        })

        if (result.ok) {
          sendResponse(id, {
            content: [{ type: 'text', text: 'Message sent to Telegram successfully.' }]
          })
        } else {
          sendResponse(id, {
            content: [{ type: 'text', text: `Failed to send: ${result.error || 'unknown error'}` }],
            isError: true
          })
        }
      } catch (err) {
        sendResponse(id, {
          content: [{ type: 'text', text: `Failed to send: ${err.message}` }],
          isError: true
        })
      }
      break
    }

    case 'notifications/initialized':
      // Client notification — no response needed
      break

    default:
      if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`)
      }
  }
}

// ── MCP stdio reader (Content-Length framed) ─────────────────────────────────
let headerBuf = ''
let expectedLength = null
let bodyBuf = ''

process.stdin.on('data', (chunk) => {
  let data = chunk.toString()

  while (data.length > 0) {
    if (expectedLength === null) {
      // Reading headers
      headerBuf += data
      const headerEnd = headerBuf.indexOf('\r\n\r\n')
      if (headerEnd === -1) {
        data = ''
        continue
      }
      const header = headerBuf.slice(0, headerEnd)
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) {
        headerBuf = ''
        data = ''
        continue
      }
      expectedLength = parseInt(match[1], 10)
      data = headerBuf.slice(headerEnd + 4)
      headerBuf = ''
      bodyBuf = ''
    }

    // Reading body
    bodyBuf += data
    if (bodyBuf.length >= expectedLength) {
      const json = bodyBuf.slice(0, expectedLength)
      data = bodyBuf.slice(expectedLength)
      expectedLength = null
      bodyBuf = ''

      try {
        const msg = JSON.parse(json)
        handleMethod(msg.id, msg.method, msg.params)
      } catch {}
    } else {
      data = ''
    }
  }
})

process.stdin.on('end', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
```

- [ ] **Step 2: Manual verification — test with echo**

Run this to verify the MCP server starts and responds to initialize:

```bash
echo 'Content-Length: 80\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}' | node src/main/telegram-mcp-server/index.js
```

Expected: JSON response containing `"serverInfo":{"name":"agenthub-telegram"`

- [ ] **Step 3: Commit**

```bash
git add src/main/telegram-mcp-server/index.js
git commit -m "feat(telegram): add MCP stdio server exposing send_telegram tool"
```

---

### Task 4: Wire socket server into service-orchestrator

**Files:**
- Modify: `src/main/services/service-orchestrator.ts:354-398`

**Interfaces:**
- Consumes: `TelegramSocketServer` from Task 2, `TelegramSidecarService` from existing code
- Produces: Socket server starts/stops with sidecar; `getSocketPath()` available to agent-manager

- [ ] **Step 1: Add import and module-level variable**

At the top of `service-orchestrator.ts`, add import:

```typescript
import { TelegramSocketServer } from './telegram-socket-server'
```

Add module-level variable near the other service variables:

```typescript
let telegramSocketServer: TelegramSocketServer | null = null
```

- [ ] **Step 2: Add getter function**

Add an exported getter (near the existing `getWindowManager`, `getAnamnesisWriter`):

```typescript
export function getTelegramSocketPath(): string | null {
  return telegramSocketServer?.getSocketPath() ?? null
}
```

- [ ] **Step 3: Wire socket server to sidecar lifecycle**

In the sidecar setup section (after `telegramSidecarService = new TelegramSidecarService({...})`, around line 383), add socket server creation and wire it to the sidecar's `onReady` callback.

Replace the existing `onReady` callback:

```typescript
    onReady: () => {
      // Push current agent list as soon as sidecar is ready
      const agents = listAgents().map(a => ({
        id: a.id, name: a.name, status: a.status,
        repo: a.cwd.split('/').pop() ?? a.cwd,
      }))
      telegramSidecarService?.sendAgentList(agents)

      // Start socket server for MCP tool connections
      if (!telegramSocketServer) {
        telegramSocketServer = new TelegramSocketServer({
          notify: (payload) => telegramSidecarService?.notify(payload),
          logInfo: (msg, meta) => log.info(msg, meta),
          logError: (msg, meta) => log.error(msg, meta),
        })
      }
      const sockPath = `/tmp/agenthub-telegram-${process.pid}.sock`
      telegramSocketServer.start(sockPath)
    },
```

- [ ] **Step 4: Add cleanup in the shutdown function**

Find the existing cleanup/shutdown logic in service-orchestrator.ts and add:

```typescript
telegramSocketServer?.stop()
telegramSocketServer = null
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/main/services/service-orchestrator.ts
git commit -m "feat(telegram): wire socket server lifecycle to sidecar"
```

---

### Task 5: Add --mcp-config to agent spawn and remove PTY scraping

**Files:**
- Modify: `src/main/services/agent-manager.ts`

**Interfaces:**
- Consumes: `getTelegramSocketPath()` from Task 4, MCP server script path
- Produces: Agents spawned with `--mcp-config` flag; PTY scraping block removed

- [ ] **Step 1: Add imports**

At the top of `agent-manager.ts`, add:

```typescript
import { getTelegramSocketPath } from './service-orchestrator'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { app } from 'electron'
```

Note: `join`, `tmpdir`, `writeFileSync`, `unlinkSync` may already be imported — check and add only what's missing.

- [ ] **Step 2: Add MCP config helper function**

Add before the `spawnAgent` function:

```typescript
function writeMcpConfig(agentId: string, agentName: string, repo: string): string | null {
  const sockPath = getTelegramSocketPath()
  if (!sockPath) return null

  const scriptPath = app.isPackaged
    ? require('path').join(process.resourcesPath, 'telegram-mcp-server', 'index.js')
    : require('path').join(process.cwd(), 'src', 'main', 'telegram-mcp-server', 'index.js')

  const config = {
    mcpServers: {
      'agenthub-telegram': {
        command: 'node',
        args: [scriptPath],
        env: {
          AGENTHUB_TELEGRAM_SOCK: sockPath,
          AGENTHUB_AGENT_ID: agentId,
          AGENTHUB_AGENT_NAME: agentName,
          AGENTHUB_AGENT_REPO: repo,
        }
      }
    }
  }

  const configPath = join(tmpdir(), `agenthub-mcp-${agentId}.json`)
  writeFileSync(configPath, JSON.stringify(config), 'utf-8')
  return configPath
}

function cleanupMcpConfig(agentId: string): void {
  try {
    unlinkSync(join(tmpdir(), `agenthub-mcp-${agentId}.json`))
  } catch {}
}
```

- [ ] **Step 3: Add --mcp-config flag to agent spawn commands**

In the `spawnAgent` function, after the `modelFlag`, `effortFlag`, `permFlag` declarations (around line 684), add:

```typescript
  const repoName = options.cwd.split('/').pop() ?? options.cwd
  const mcpConfigPath = writeMcpConfig(agentState.id, agentState.name, repoName)
  const mcpFlag = mcpConfigPath ? ` --mcp-config '${mcpConfigPath}'` : ''
```

Then add `${mcpFlag}` to each `claude` command string:

Line ~729 (task mode): change to:
```typescript
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${mcpFlag} '${escapedTask}'\n`
```

Line ~735 (interactive mode): change to:
```typescript
      const cmd = `clear; claude${modelFlag}${effortFlag}${permFlag}${mcpFlag}\n`
```

For Ollama agents (line ~697-699): MCP flag is NOT added — Ollama launch doesn't support `--mcp-config`.

- [ ] **Step 4: Add MCP config cleanup to exit handler**

In the agent exit handler (around line 575-610), add `cleanupMcpConfig(agentState.id)` before `agents.delete(agentState.id)`:

```typescript
    cleanupMcpConfig(agentState.id)
    managed?.headlessTerminal.dispose()
    agents.delete(agentState.id)
```

Also add cleanup in the other agent deletion points (search for `agents.delete` — there are ~4 locations including kill, respawn, shutdown cleanup). Add `cleanupMcpConfig(agentId)` before each.

- [ ] **Step 5: Remove the PTY scraping notification block**

In `emitTriageResult` function, find the delayed send block (lines ~210-252 — the `managed.telegramSendTimer = setTimeout(...)` block). Replace the entire block with a simplified version that sends status-only:

```typescript
        if (managed) {
          managed.telegramSendTimer = setTimeout(() => {
            if (managed) managed.telegramSendTimer = null
            // Status-only notification — agent sends content via MCP tool
            payload.summary = (agent.taskDescription ?? '').slice(0, 200) || agent.name
            if (_telegramNotifier) _telegramNotifier(payload)
          }, 3000)
        }
```

- [ ] **Step 6: Update ManagedAgent comment**

Update the `telegramSendTimer` comment in the `ManagedAgent` interface (line ~67-68):

```typescript
  /** Delayed Telegram status notification — 3s debounce for rapid status changes. */
  telegramSendTimer: ReturnType<typeof setTimeout> | null
```

And update the `lastFilteredProse` comment (line ~65-66):

```typescript
  /** Last filtered LLM prose captured by TTS — used by TTS only. */
  lastFilteredProse: string
```

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/main/services/agent-manager.ts
git commit -m "feat(telegram): add --mcp-config to agent spawn, remove PTY scraping"
```

---

### Task 6: Create the telegram-notify skill

**Files:**
- Create: `.claude/commands/telegram-notify.md`

**Interfaces:**
- Consumes: `send_telegram` MCP tool (Task 3)
- Produces: Skill document auto-discovered by Claude CLI

- [ ] **Step 1: Write the skill**

Create `.claude/commands/telegram-notify.md`:

```markdown
# Telegram Notifications

You have a `send_telegram` tool available. Use it to message the user on their phone.

## When to send

- **Task completed** — summarize what you did and the outcome
- **Need user input** — ask a clear, specific question
- **Error or blocker** — explain what went wrong and what you tried
- **Significant milestone** — only if the user asked for progress updates

## How to compose

- Write for a phone screen — short paragraphs, no terminal formatting
- Lead with the outcome, then supporting details
- Code snippets are fine but keep them under 20 lines
- For questions: be specific about what you need and what the options are

## Format parameter

- `status` — task done, milestones, informational updates
- `question` — you need input to proceed
- `error` — failures, blockers, unrecoverable issues

## Examples

Task completed:
```
send_telegram(message: "Fixed the login bug. The issue was a stale session token — I added a refresh check before each API call. 3 tests added, all passing.", format: "status")
```

Need input:
```
send_telegram(message: "The database migration requires choosing between two approaches:\n\n1. Add a nullable column now, backfill later (faster, needs follow-up)\n2. Full migration with backfill (slower, complete)\n\nWhich do you prefer?", format: "question")
```

Error:
```
send_telegram(message: "Build is failing — node-gyp can't find Python 3.11. I've tried pyenv and brew installs. Need you to check your system Python setup.", format: "error")
```

## Don'ts

- Don't send after every tool call or file read
- Don't send raw terminal output or ANSI codes
- Don't send more than 2-3 messages per task unless asked for updates
- Don't duplicate the automatic status notifications (the system handles those)
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/telegram-notify.md
git commit -m "feat(telegram): add telegram-notify skill for agent guidance"
```

---

### Task 7: Integration test and cleanup

**Files:**
- Modify: `src/main/services/agent-manager.ts` (if needed)
- No new test files — manual integration verification

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified working system

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All existing tests pass. The only known pre-existing failure is `connection.test.ts` (user_version 26 vs 25).

- [ ] **Step 2: TypeScript full check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Manual integration test**

1. Build the app: `npm run build` (or dev mode)
2. Connect Telegram bot in Settings
3. Spawn an agent with a simple task (e.g. "say hello and then use the send_telegram tool to tell me what you said")
4. Verify: the agent calls `send_telegram` and you receive the message on your phone
5. Verify: the automatic status notification (completed) also arrives with task description only

- [ ] **Step 4: Verify cleanup**

1. Kill the agent
2. Check `/tmp/` for stale `agenthub-mcp-*.json` files — should be cleaned up
3. Stop AgentHub
4. Check `/tmp/` for stale `agenthub-telegram-*.sock` — should be cleaned up

- [ ] **Step 5: Remove debug logging block (optional cleanup)**

In `agent-manager.ts`, the `[Telegram Debug] cleanTextBuffer pipeline` logging block (lines ~146-160) is no longer useful for Telegram. Remove it if it clutters logs, or leave it if TTS debugging still benefits from it.

- [ ] **Step 6: Final commit if any cleanup was done**

```bash
git add -A
git commit -m "chore(telegram): integration verification and cleanup"
```
