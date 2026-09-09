'use strict'

const readline = require('readline')

function mcpResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function mcpError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

/**
 * Wire up MCP JSON-RPC protocol on stdin.
 * handler(method, params, id) is called for each valid request.
 */
function createMcpStdioReader(handler) {
  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    const { method, params, id } = msg
    if (method === 'initialize') {
      mcpResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agenthub-kanban', version: '1.0.0' }
      })
      return
    }
    if (method === 'notifications/initialized') return
    if (method === 'shutdown') {
      mcpResponse(id, null)
      process.exit(0)
    }
    handler(method, params ?? {}, id)
  })
}

module.exports = { mcpResponse, mcpError, createMcpStdioReader }
