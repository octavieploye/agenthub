import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'
import type { GuardrailConfig } from '@shared/types/config.types'
import type { ModelCatalogEntry } from '@shared/types/model.types'
import type { HealthAnomaly } from '@shared/types/health.types'
import type { AgentState } from '@shared/types/agent.types'
import type { OrchestratorStatusResponse } from '@shared/types/orchestrator.types'
import type {
  GetGuardrailsToolInput,
  GetGuardrailsToolOutput,
  GetSkillsToolInput,
  GetSkillsToolOutput,
  GetContextToolInput,
  SelfAwarenessManifest,
  SelfAwarenessManifestRepo,
  SelfAwarenessManifestQuota,
  SelfAwarenessManifestSafeguards,
  McpIpcRequest,
  McpIpcResponse
} from '@shared/types/mcp-server.types'
import { SkillsService } from '../../services/skills-service'

// ─── Shared no-op logger for child-process context (no electron-log) ──────────

const NOOP_LOGGER = {
  logInfo: (_msg: string, _meta?: Record<string, unknown>): void => {},
  logWarning: (_msg: string, _meta?: Record<string, unknown>): void => {}
}

// ─── SkillsService singleton ──────────────────────────────────────────────────
// SkillsService is safe to cache at module level: agenthubPath is stable across
// the lifetime of the child process, and the service maintains its own internal
// per-scan-path cache (Map<string, SkillItem[]>) — singleton avoids redundant
// instantiation on every handleGetSkills / handleGetContext call.

let _skillsService: SkillsService | null = null

function getSkillsService(agenthubPath: string): SkillsService {
  if (!_skillsService) _skillsService = new SkillsService({ ...NOOP_LOGGER, agenthubPath })
  return _skillsService
}

// ─── handleGetGuardrails ──────────────────────────────────────────────────────

export function handleGetGuardrails(
  input: GetGuardrailsToolInput,
  registeredRepoPaths: string[],
  agenthubPath: string
): GetGuardrailsToolOutput {
  if (input.repoPath !== agenthubPath && !registeredRepoPaths.includes(input.repoPath)) {
    return { guardrails: { ...DEFAULT_GUARDRAILS }, source: 'default' }
  }

  const yamlPath = join(input.repoPath, '.agenthub.yaml')

  if (!existsSync(yamlPath)) {
    return { guardrails: { ...DEFAULT_GUARDRAILS }, source: 'default' }
  }

  try {
    const raw = readFileSync(yamlPath, 'utf-8')
    const parsed = yaml.load(raw) as Partial<GuardrailConfig>

    const guardrails: GuardrailConfig = {
      maxDurationMinutes:
        typeof parsed?.maxDurationMinutes === 'number'
          ? parsed.maxDurationMinutes
          : DEFAULT_GUARDRAILS.maxDurationMinutes,
      maxFilesChanged:
        typeof parsed?.maxFilesChanged === 'number'
          ? parsed.maxFilesChanged
          : DEFAULT_GUARDRAILS.maxFilesChanged,
      maxConsecutiveErrors:
        typeof parsed?.maxConsecutiveErrors === 'number'
          ? parsed.maxConsecutiveErrors
          : DEFAULT_GUARDRAILS.maxConsecutiveErrors,
      maxTokensPerSession:
        typeof parsed?.maxTokensPerSession === 'number'
          ? parsed.maxTokensPerSession
          : DEFAULT_GUARDRAILS.maxTokensPerSession,
      protectedPaths: Array.isArray(parsed?.protectedPaths)
        ? parsed.protectedPaths
        : DEFAULT_GUARDRAILS.protectedPaths
    }

    return { guardrails, source: 'file' }
  } catch {
    return { guardrails: { ...DEFAULT_GUARDRAILS }, source: 'default' }
  }
}

// ─── handleGetSkills ──────────────────────────────────────────────────────────

export function handleGetSkills(
  input: GetSkillsToolInput,
  agenthubPath: string,
  registeredRepoPaths: string[]
): GetSkillsToolOutput {
  if (
    input.repoPath !== undefined &&
    input.repoPath !== agenthubPath &&
    !registeredRepoPaths.includes(input.repoPath)
  ) {
    return { skills: [], total: 0 }
  }

  const service = getSkillsService(agenthubPath)
  // When repoPath is provided, scan that repo's skills alongside agenthub's.
  // When absent, pass agenthubPath so the agenthub scan runs as the primary repo.
  const scanPath = input.repoPath ?? agenthubPath
  const all = service.listSkills(scanPath)

  const skills = input.query
    ? (() => {
        const q = input.query.toLowerCase()
        return all.filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            (s.description?.toLowerCase().includes(q) ?? false)
        )
      })()
    : all

  return { skills, total: skills.length }
}

// ─── ContextHandlerDeps ───────────────────────────────────────────────────────

export interface ContextHandlerDeps {
  /** Send a typed request to the parent process via Unix socket */
  sendIpc: (req: McpIpcRequest) => Promise<McpIpcResponse>
  /** Path to agenthub repo root — used for skill scanning */
  agenthubPath: string
  /**
   * Optional path to the target repo being worked on.
   * When provided and different from agenthubPath, skills from both repos are included.
   * SkillsService.listSkills performs the dual scan internally when repoPath differs.
   * Injected from AGENTHUB_ACTIVE_REPO_PATH env var set by parent process at spawn.
   */
  repoPath?: string
  /** App version string (from package.json or env) */
  appVersion: string
  /** Repos from the read-only DB */
  getRepos: () => SelfAwarenessManifestRepo[]
  /** Current token quota state */
  getQuota: () => SelfAwarenessManifestQuota
  /** Current safeguards state */
  getSafeguards: () => SelfAwarenessManifestSafeguards
  /** Available model catalog entries */
  getModelCatalog: () => ModelCatalogEntry[]
}

// ─── handleGetContext ─────────────────────────────────────────────────────────

export async function handleGetContext(
  input: GetContextToolInput,
  deps: ContextHandlerDeps
): Promise<SelfAwarenessManifest> {
  // Fire all IPC calls in parallel to minimise latency
  const [agentsResp, orchResp, healthResp] = await Promise.all([
    deps.sendIpc({ type: 'get_active_agents', payload: {} }),
    deps.sendIpc({ type: 'get_orchestrator_status', payload: {} }),
    deps.sendIpc({ type: 'get_health_anomalies', payload: { agentId: input.agentId } })
  ])

  // Agents — map AgentState → SelfAwarenessManifestAgent
  const rawAgents =
    agentsResp.type === 'success' && Array.isArray(agentsResp.data)
      ? (agentsResp.data as AgentState[]).filter(
          (a): a is AgentState =>
            a !== null && typeof a === 'object' && typeof a.id === 'string' && typeof a.status === 'string'
        )
      : []
  const agents = rawAgents.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    repoId: a.repoId,
    model: a.model,
    provider: a.provider
  }))

  // Orchestrator — map OrchestratorStatusResponse → SelfAwarenessManifestOrchestrator
  const orchData =
    orchResp.type === 'success' &&
    orchResp.data !== null &&
    typeof orchResp.data === 'object'
      ? (orchResp.data as OrchestratorStatusResponse)
      : null
  const isRunning =
    orchData?.run?.status === 'running' || orchData?.run?.status === 'paused'
  const orchestrator = {
    enabled: isRunning,
    status: orchData?.run?.status ?? null,
    activeTaskCount: orchData?.activeTasks?.length ?? 0,
    agentsSpawnedByRun: orchData?.activeTasks?.length ?? 0,
    agentCap: 3
  }

  // Health anomalies — flat array from parent monitor
  const healthAnomalies =
    healthResp.type === 'success' && Array.isArray(healthResp.data)
      ? (healthResp.data as HealthAnomaly[]).filter(
          (h): h is HealthAnomaly =>
            h !== null && typeof h === 'object' && typeof (h as Record<string, unknown>).type === 'string'
        )
      : []

  // Skills — scan agenthub always; when repoPath is provided and differs from agenthubPath,
  // SkillsService.listSkills performs both scans internally and merges the results.
  const skillsService = getSkillsService(deps.agenthubPath)
  const skillScanPath = deps.repoPath ?? deps.agenthubPath
  const skills = skillsService.listSkills(skillScanPath)

  return {
    timestamp: new Date().toISOString(),
    appVersion: deps.appVersion,
    orchestrator,
    agents,
    repos: deps.getRepos(),
    quota: deps.getQuota(),
    safeguards: deps.getSafeguards(),
    modelCatalog: deps.getModelCatalog(),
    skills,
    healthAnomalies
  }
}
