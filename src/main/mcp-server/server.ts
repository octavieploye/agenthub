/**
 * AgentHub Kanban MCP Server — entry point
 *
 * Spawned as a child process by McpServerManager (S4).
 * Communicates with the AgentHub main process via a Unix domain socket (IPC)
 * and with the Claude/Codex agent via stdio (MCP protocol).
 *
 * Required env vars:
 *   AGENTHUB_DB_PATH     — absolute path to agenthub.db
 *   AGENTHUB_SOCKET_PATH — absolute path to the parent IPC socket
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { join, dirname } from 'path'
import { readFileSync, existsSync } from 'fs'

import {
  openReadOnly,
  listReposReadOnly,
  getQuotaReadOnly,
  getSafeguardsReadOnly
} from './db/read-connection'
import { ParentIpc } from './ipc/parent-ipc'
import { handleCreateTask, handleListTasks, handleDispatchTask } from './handlers/task-handlers'
import { handleEstimateTokens, handleRecommendModel } from './handlers/model-handlers'
import { handleGetGuardrails, handleGetSkills, handleGetContext } from './handlers/context-handlers'
import { handleAuditDeps } from './handlers/deps-handler'

import type {
  CreateTaskToolInput,
  ListTasksToolInput,
  DispatchTaskToolInput,
  EstimateTokensToolInput,
  RecommendModelToolInput,
  GetGuardrailsToolInput,
  GetSkillsToolInput,
  GetContextToolInput,
  AuditDepsToolInput
} from '@shared/types/mcp-server.types'
import type { ModelCatalogEntry } from '@shared/types/model.types'

// ─── Environment ──────────────────────────────────────────────────────────────

const dbPath = process.env['AGENTHUB_DB_PATH']
const socketPath = process.env['AGENTHUB_SOCKET_PATH']
const socketToken = process.env['AGENTHUB_SOCKET_TOKEN']

if (!dbPath) {
  process.stderr.write('[mcp-server] FATAL: AGENTHUB_DB_PATH is not set\n')
  process.exit(1)
}
if (!socketPath) {
  process.stderr.write('[mcp-server] FATAL: AGENTHUB_SOCKET_PATH is not set\n')
  process.exit(1)
}
if (!socketToken) {
  process.stderr.write('[mcp-server] FATAL: AGENTHUB_SOCKET_TOKEN is not set\n')
  process.exit(1)
}

// Derive agenthub root from the DB path: <root>/agenthub.db → <root>
const agenthubPath = dirname(dbPath)
if (!existsSync(join(agenthubPath, 'package.json'))) {
  process.stderr.write(
    `[mcp-server] WARN: agenthubPath "${agenthubPath}" has no package.json — skill/plugin resolution may fail\n`
  )
}

// App version from package.json
function readAppVersion(): string {
  try {
    const pkgPath = join(agenthubPath, 'package.json')
    if (!existsSync(pkgPath)) return '0.0.0'
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const APP_VERSION = readAppVersion()

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // 1. Open read-only DB
  const db = openReadOnly(dbPath!)

  // 2. Connect parent IPC socket
  const parentIpc = new ParentIpc(socketPath!, socketToken!)
  await parentIpc.connect()

  // 3. Shared deps
  const sendIpc = parentIpc.send.bind(parentIpc)
  const taskDeps = { db, sendIpc }

  const contextDeps = {
    sendIpc,
    agenthubPath,
    appVersion: APP_VERSION,
    getRepos: () => listReposReadOnly(db),
    getQuota: () => getQuotaReadOnly(db),
    getSafeguards: () => getSafeguardsReadOnly(db),
    getModelCatalog: (): ModelCatalogEntry[] => []
  }
  const auditDependencyRoots = [agenthubPath, ...listReposReadOnly(db).map((repo) => repo.path)]

  // 4. MCP Server
  const server = new Server(
    { name: 'agenthub-kanban', version: APP_VERSION },
    { capabilities: { tools: {} } }
  )

  // ─── Tool registry ────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_task',
        description:
          'Create a new task in the AgentHub Kanban board. Optionally runs token estimation and risk scoring automatically.',
        inputSchema: {
          type: 'object',
          properties: {
            repoId: { type: 'string', description: 'ID of the target repository' },
            title: { type: 'string', description: 'Short task title' },
            description: { type: 'string', description: 'Detailed task description' },
            sprintName: { type: 'string', description: 'Sprint name to associate the task with' },
            epicName: { type: 'string', description: 'Epic name within the sprint' },
            category: { type: 'string', description: 'Task category (e.g. backend, frontend)' },
            priority: { type: 'number', enum: [1, 2, 3], description: '1=High, 2=Medium, 3=Low' },
            requiresApproval: {
              type: 'boolean',
              description: 'Whether the task requires human approval before dispatch'
            },
            modelOverride: {
              type: 'string',
              description: 'Override the default model for this task'
            },
            providerOverride: { type: 'string', description: 'Override the default provider' },
            targetFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files this task will modify'
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skill names or paths to load for this task'
            },
            guardrailOverrides: {
              type: 'object',
              description: 'Partial GuardrailConfig overrides'
            },
            autoEstimate: {
              type: 'boolean',
              description: 'Automatically estimate token cost before creating'
            },
            autoRecommendModel: {
              type: 'boolean',
              description: 'Automatically recommend a model based on complexity and risk'
            },
            createdBy: {
              type: 'string',
              description: 'Identifier for the creating agent (default: mcp-agent)'
            }
          },
          required: ['repoId', 'title']
        }
      },
      {
        name: 'list_tasks',
        description:
          'List tasks from the Kanban board, optionally filtered by repo, sprint, status, or category.',
        inputSchema: {
          type: 'object',
          properties: {
            repoId: { type: 'string', description: 'Filter by repo ID' },
            sprintName: { type: 'string', description: 'Filter by sprint name' },
            status: {
              type: 'string',
              description:
                'Filter by status (backlog, today, in_progress, completed, tested, interrupted)'
            },
            category: { type: 'string', description: 'Filter by category' },
            limit: { type: 'number', description: 'Maximum number of tasks to return (default 50)' }
          }
        }
      },
      {
        name: 'dispatch_task',
        description:
          'Dispatch a Kanban task to the orchestrator for automated execution. Enforces S1 kill-switch and S4 confirmation gate. Main process enforces S5 budget cap.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'ID of the task to dispatch' },
            telegramNotify: {
              type: 'boolean',
              description: 'Send Telegram notifications during execution'
            },
            confirmed: {
              type: 'boolean',
              description: 'Must be true — explicit confirmation required before dispatch'
            }
          },
          required: ['taskId', 'confirmed']
        }
      },
      {
        name: 'estimate_tokens',
        description:
          'Estimate the input token cost for a task, including description, target files, and skill content.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Task description text' },
            targetFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'File paths that will be read as context'
            },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'Skill paths whose SKILL.md files are counted'
            }
          },
          required: ['description']
        }
      },
      {
        name: 'recommend_model',
        description:
          'Recommend a Claude model for a task based on complexity, risk score, and token budget.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Task description' },
            targetFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Target files for context'
            },
            skills: { type: 'array', items: { type: 'string' }, description: 'Skill paths' },
            estimatedTokens: {
              type: 'number',
              description: 'Pre-computed token estimate (skips re-estimation)'
            },
            riskScore: { type: 'number', description: 'Risk score 0–1 from risk calculator' }
          },
          required: ['description']
        }
      },
      {
        name: 'get_guardrails',
        description:
          'Read the active GuardrailConfig for a repository from its .agenthub.yaml file.',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: { type: 'string', description: 'Absolute path to the repository root' }
          },
          required: ['repoPath']
        }
      },
      {
        name: 'get_skills',
        description:
          'List available skills from the AgentHub plugin directories, optionally filtered by query string.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Optional text filter applied to skill name, ID, and description'
            }
          }
        }
      },
      {
        name: 'get_context',
        description:
          'Return the AgentHub self-awareness manifest: active agents, repos, quota, safeguards, model catalog, skills, and health anomalies.',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Optional agent ID to scope health anomalies' }
          }
        }
      },
      {
        name: 'audit_deps',
        description:
          'Audit npm dependencies in a package.json against the npm registry (max 20 deps, 5s timeout per package).',
        inputSchema: {
          type: 'object',
          properties: {
            packageJsonPath: {
              type: 'string',
              description: 'Absolute path to the package.json file to audit'
            }
          },
          required: ['packageJsonPath']
        }
      }
    ]
  }))

  // ─── Tool dispatch ────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const safeArgs = (args ?? {}) as Record<string, unknown>

    try {
      let result: unknown

      switch (name) {
        case 'create_task':
          result = await handleCreateTask(safeArgs as unknown as CreateTaskToolInput, taskDeps)
          break

        case 'list_tasks':
          result = handleListTasks(safeArgs as unknown as ListTasksToolInput, db)
          break

        case 'dispatch_task':
          result = await handleDispatchTask(safeArgs as unknown as DispatchTaskToolInput, taskDeps)
          break

        case 'estimate_tokens':
          result = handleEstimateTokens(safeArgs as unknown as EstimateTokensToolInput)
          break

        case 'recommend_model':
          result = handleRecommendModel(safeArgs as unknown as RecommendModelToolInput)
          break

        case 'get_guardrails':
          result = handleGetGuardrails(safeArgs as unknown as GetGuardrailsToolInput)
          break

        case 'get_skills':
          result = handleGetSkills(safeArgs as unknown as GetSkillsToolInput, agenthubPath)
          break

        case 'get_context':
          result = await handleGetContext(safeArgs as unknown as GetContextToolInput, contextDeps)
          break

        case 'audit_deps':
          result = await handleAuditDeps(
            safeArgs as unknown as AuditDepsToolInput,
            auditDependencyRoots
          )
          break

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true
          }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text', text: `Error in ${name}: ${msg}` }],
        isError: true
      }
    }
  })

  // 5. Stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  process.stderr.write(`[mcp-server] agenthub-kanban MCP server started (v${APP_VERSION})\n`)

  // 6. Graceful shutdown
  const shutdown = (): void => {
    parentIpc.close()
    void server.close().catch(() => {})
    db.close()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('exit', () => {
    try {
      db.close()
    } catch {
      /* ignore */
    }
  })
}

main().catch((err) => {
  process.stderr.write(
    `[mcp-server] Fatal startup error: ${err instanceof Error ? err.message : String(err)}\n`
  )
  process.exit(1)
})
