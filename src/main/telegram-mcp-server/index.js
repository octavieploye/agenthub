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
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
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
        protocolVersion: params?.protocolVersion || '2024-11-05',
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

// ── MCP stdio reader (bare JSONL — newline-delimited JSON) ───────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  if (!line.trim()) return
  try {
    const msg = JSON.parse(line)
    handleMethod(msg.id, msg.method, msg.params)
  } catch {}
})
rl.on('close', () => process.exit(0))

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
