'use strict'

// MCP bridge server — pure JS, ZERO native modules.
// Spawned under system `node` (not Electron). All DB access goes through
// the Unix socket IPC bridge (McpBridgeHandler in main process).
// Claude CLI <─ stdio/JSON-RPC ─> this process <─ Unix socket ─> McpBridgeHandler <─> DB

const { socketRequest } = require('../mcp-helpers/unix-socket-client')
const { mcpResponse, mcpError, createMcpStdioReader } = require('../mcp-helpers/mcp-protocol')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ── Env ──────────────────────────────────────────────────────────────────────

const BRIDGE_SOCK = process.env.AGENTHUB_MCP_BRIDGE_SOCK
const BRIDGE_TOKEN = process.env.AGENTHUB_MCP_BRIDGE_TOKEN
const REPO_ROOT = process.env.AGENTHUB_REPO_ROOT || process.cwd()

function log(msg) {
  process.stderr.write('[mcp-bridge-server] ' + msg + '\n')
}

if (!BRIDGE_SOCK) {
  log('FATAL: AGENTHUB_MCP_BRIDGE_SOCK is not set')
  process.exit(1)
}
if (!BRIDGE_TOKEN) {
  log('FATAL: AGENTHUB_MCP_BRIDGE_TOKEN is not set')
  process.exit(1)
}

// ── Bridge helper ─────────────────────────────────────────────────────────────

async function callBridge(method, params) {
  return socketRequest(BRIDGE_SOCK, {
    id: Date.now().toString(),
    token: BRIDGE_TOKEN,
    method,
    params: params || {}
  })
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function getContext(args) {
  const [activeRun, tasks, safeguards, quota, repos] = await Promise.all([
    callBridge('getActiveRun', {}).catch(() => null),
    callBridge('listTasks', { limit: 100 }).catch(() => ({ tasks: [] })),
    callBridge('getSafeguards', {}).catch(() => null),
    callBridge('getQuota', {}).catch(() => null),
    callBridge('listRepos', {}).catch(() => ({ repos: [] }))
  ])

  return {
    runStatus: activeRun || null,
    activeAgents: (tasks && tasks.tasks)
      ? tasks.tasks.filter((t) => t.status === 'in_progress')
      : [],
    repos: (repos && repos.repos) ? repos.repos : [],
    quota: quota || null,
    safeguards: safeguards || null,
    health: 'ok'
  }
}

async function listTasks(args) {
  const params = {}
  if (args && args.status) params.status = args.status
  if (args && args.repoId) params.repoId = args.repoId
  if (args && args.sprintName) params.sprintName = args.sprintName
  if (args && args.category) params.category = args.category
  if (args && args.limit) params.limit = args.limit
  if (args && args.includeArchived) params.includeArchived = args.includeArchived
  return callBridge('listTasks', params)
}

async function createTask(args) {
  return callBridge('createTask', args || {})
}

async function dispatchTask(args) {
  return callBridge('dispatchTask', args || {})
}

async function dispatchSprint(args) {
  return callBridge('dispatchSprint', args || {})
}

function estimateTokens(args) {
  const description = (args && args.description) ? args.description : ''
  const estimated = Math.ceil(description.length / 4)
  return { estimated, note: 'character-based estimate' }
}

function recommendModel(args) {
  const complexity = (args && args.complexity) ? args.complexity : 'medium'
  const contextSize = (args && typeof args.contextSize === 'number') ? args.contextSize : 0

  if (complexity === 'low' && contextSize < 50000) {
    return { model: 'claude-haiku-4-5', reason: 'low complexity, small context' }
  }
  if (complexity === 'high' || contextSize > 100000) {
    return { model: 'claude-sonnet-4-6', reason: 'high complexity or large context' }
  }
  return { model: 'claude-sonnet-4-6', reason: 'medium complexity' }
}

function getGuardrails(args) {
  const repoPath = (args && args.repoPath) ? args.repoPath : REPO_ROOT
  const yamlPath = path.join(repoPath, '.agenthub.yaml')

  const DEFAULT_GUARDRAILS = {
    maxDurationMinutes: 45,
    maxFilesChanged: 50,
    maxConsecutiveErrors: 3,
    maxTokensPerSession: 100000,
    protectedPaths: []
  }

  if (!fs.existsSync(yamlPath)) {
    return { guardrails: DEFAULT_GUARDRAILS, source: 'default' }
  }

  try {
    const raw = fs.readFileSync(yamlPath, 'utf-8')
    // Minimal YAML parser for simple key: value pairs (no nested objects needed here)
    const parsed = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const colon = trimmed.indexOf(':')
      if (colon === -1) continue
      const key = trimmed.slice(0, colon).trim()
      const val = trimmed.slice(colon + 1).trim()
      if (val === '[]') {
        parsed[key] = []
      } else if (!isNaN(Number(val)) && val !== '') {
        parsed[key] = Number(val)
      } else if (val === 'true') {
        parsed[key] = true
      } else if (val === 'false') {
        parsed[key] = false
      } else {
        parsed[key] = val
      }
    }
    return {
      guardrails: {
        maxDurationMinutes: typeof parsed.maxDurationMinutes === 'number' ? parsed.maxDurationMinutes : DEFAULT_GUARDRAILS.maxDurationMinutes,
        maxFilesChanged: typeof parsed.maxFilesChanged === 'number' ? parsed.maxFilesChanged : DEFAULT_GUARDRAILS.maxFilesChanged,
        maxConsecutiveErrors: typeof parsed.maxConsecutiveErrors === 'number' ? parsed.maxConsecutiveErrors : DEFAULT_GUARDRAILS.maxConsecutiveErrors,
        maxTokensPerSession: typeof parsed.maxTokensPerSession === 'number' ? parsed.maxTokensPerSession : DEFAULT_GUARDRAILS.maxTokensPerSession,
        protectedPaths: Array.isArray(parsed.protectedPaths) ? parsed.protectedPaths : DEFAULT_GUARDRAILS.protectedPaths
      },
      source: 'file'
    }
  } catch (err) {
    log('getGuardrails: failed to read yaml: ' + err.message)
    return { guardrails: DEFAULT_GUARDRAILS, source: 'default' }
  }
}

function getSkills(args) {
  const searchPaths = [
    path.join(REPO_ROOT, '.claude', 'skills'),
    path.join(REPO_ROOT, 'plugin', 'skills')
  ]

  const skills = []
  for (const dir of searchPaths) {
    if (!fs.existsSync(dir)) continue
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (args && args.query) {
        if (!name.toLowerCase().includes(args.query.toLowerCase())) continue
      }
      skills.push({ name, path: path.join(dir, name) })
    }
  }

  return { skills, total: skills.length }
}

function auditDeps(args) {
  const packageJsonPath = (args && args.packageJsonPath) ? args.packageJsonPath : path.join(REPO_ROOT, 'package.json')
  const cwd = path.dirname(packageJsonPath)

  try {
    const output = execSync('npm audit --json', { cwd, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] })
    return JSON.parse(output.toString())
  } catch (err) {
    // npm audit exits with non-zero when vulnerabilities found — stdout still has JSON
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout.toString())
      } catch {
        // fall through
      }
    }
    return { error: err.message, note: 'npm audit failed or JSON parse error' }
  }
}

async function approveTask(args) {
  return callBridge('approveTask', args || {})
}

async function reportFilesChanged(args) {
  return callBridge('reportFilesChanged', args || {})
}

async function archiveTask(args) {
  return callBridge('archiveTask', args || {})
}

async function createProject(args) {
  return callBridge('createProject', args || {})
}

// ── Tool definitions (MCP capabilities) ───────────────────────────────────────

const TOOL_DEFS = [
  {
    name: 'get_context',
    description: 'Return the AgentHub self-awareness manifest: active agents, repos, quota, safeguards, and health.',
    inputSchema: { type: 'object', properties: { agentId: { type: 'string', description: 'Optional agent ID to scope health anomalies' } } }
  },
  {
    name: 'list_tasks',
    description: 'List tasks from the Kanban board, optionally filtered by repo, sprint, status, or category.',
    inputSchema: {
      type: 'object',
      properties: {
        repoId: { type: 'string' },
        sprintName: { type: 'string' },
        status: { type: 'string', description: 'backlog, today, in_progress, completed, tested, interrupted' },
        category: { type: 'string' },
        limit: { type: 'number' },
        includeArchived: { type: 'boolean' }
      }
    }
  },
  {
    name: 'create_task',
    description: 'Create a new task in the AgentHub Kanban board.',
    inputSchema: {
      type: 'object',
      properties: {
        repoId: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['repoId', 'title'],
      additionalProperties: true
    }
  },
  {
    name: 'dispatch_task',
    description: 'Dispatch a Kanban task to the orchestrator for automated execution. confirmed must be true.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        confirmed: { type: 'boolean' },
        telegramNotify: { type: 'boolean' }
      },
      required: ['taskId', 'confirmed']
    }
  },
  {
    name: 'dispatch_sprint',
    description: 'Dispatch all tasks in a sprint to the orchestrator. confirmed must be true.',
    inputSchema: {
      type: 'object',
      properties: {
        sprintName: { type: 'string' },
        repoId: { type: 'string' },
        projectId: { type: 'string' },
        concurrencyCap: { type: 'number' },
        telegramNotify: { type: 'boolean' },
        confirmed: { type: 'boolean' }
      },
      required: ['sprintName', 'repoId', 'confirmed']
    }
  },
  {
    name: 'estimate_tokens',
    description: 'Estimate the input token cost for a task description.',
    inputSchema: {
      type: 'object',
      properties: { description: { type: 'string' } },
      required: ['description']
    }
  },
  {
    name: 'recommend_model',
    description: 'Recommend a Claude model based on task complexity and context size.',
    inputSchema: {
      type: 'object',
      properties: {
        complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
        contextSize: { type: 'number', description: 'Estimated token count' }
      }
    }
  },
  {
    name: 'get_guardrails',
    description: 'Read the active GuardrailConfig for a repository from its .agenthub.yaml file.',
    inputSchema: {
      type: 'object',
      properties: { repoPath: { type: 'string', description: 'Absolute path to the repository root' } },
      required: ['repoPath']
    }
  },
  {
    name: 'get_skills',
    description: 'List available skills from .claude/skills/ and plugin/skills/ directories.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional text filter on skill name' } }
    }
  },
  {
    name: 'audit_deps',
    description: 'Run npm audit against a package.json and return the JSON result.',
    inputSchema: {
      type: 'object',
      properties: { packageJsonPath: { type: 'string', description: 'Absolute path to package.json' } },
      required: ['packageJsonPath']
    }
  },
  {
    name: 'approve_task',
    description: 'Approve or reject a task that is pending user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        taskId: { type: 'string' },
        approved: { type: 'boolean' }
      },
      required: ['runId', 'taskId', 'approved']
    }
  },
  {
    name: 'report_files_changed',
    description: 'Report the list of files modified by this agent for Path B-2 tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } }
      },
      required: ['taskId', 'files']
    }
  },
  {
    name: 'archive_task',
    description: 'Soft-delete a task by setting its status to archived.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId']
    }
  },
  {
    name: 'create_project',
    description: 'Create or retrieve a project in the AgentHub Kanban board. Idempotent by name.',
    inputSchema: {
      type: 'object',
      properties: {
        repoId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['repoId', 'name']
    }
  }
]

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function handleRequest(method, params, id) {
  if (method === 'tools/list') {
    mcpResponse(id, { tools: TOOL_DEFS })
    return
  }

  if (method !== 'tools/call') {
    mcpError(id, -32601, `Unknown method: ${method}`)
    return
  }

  const name = params && params.name
  const args = (params && params.arguments) || {}

  try {
    let result
    switch (name) {
      case 'get_context':         result = await getContext(args); break
      case 'list_tasks':          result = await listTasks(args); break
      case 'create_task':         result = await createTask(args); break
      case 'dispatch_task':       result = await dispatchTask(args); break
      case 'dispatch_sprint':     result = await dispatchSprint(args); break
      case 'estimate_tokens':     result = estimateTokens(args); break
      case 'recommend_model':     result = recommendModel(args); break
      case 'get_guardrails':      result = getGuardrails(args); break
      case 'get_skills':          result = getSkills(args); break
      case 'audit_deps':          result = auditDeps(args); break
      case 'approve_task':        result = await approveTask(args); break
      case 'report_files_changed':result = await reportFilesChanged(args); break
      case 'archive_task':        result = await archiveTask(args); break
      case 'create_project':      result = await createProject(args); break
      default:
        mcpError(id, -32601, `Unknown tool: ${name}`)
        return
    }
    mcpResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
  } catch (err) {
    log(`tool ${name} error: ${err.message}`)
    mcpError(id, -32603, err.message)
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

log('starting on bridge socket: ' + BRIDGE_SOCK)
createMcpStdioReader(handleRequest)

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
