import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

export interface CodexMcpConfigOptions {
  targetDir: string
  agentId: string
  agentName: string
  repoName: string
  telegramSocketPath: string | null
  telegramScriptPath: string
}

function configPath(targetDir: string, agentId: string): string {
  return join(targetDir, `codex-mcp-${agentId}.json`)
}

export function writeCodexMcpConfig(options: CodexMcpConfigOptions): string | null {
  const { targetDir, agentId, agentName, repoName, telegramSocketPath, telegramScriptPath } =
    options

  if (!telegramSocketPath) {
    return null
  }

  const config = {
    mcpServers: {
      'agenthub-telegram': {
        command: 'node',
        args: [telegramScriptPath],
        env: {
          AGENTHUB_TELEGRAM_SOCK: telegramSocketPath,
          AGENTHUB_AGENT_ID: agentId,
          AGENTHUB_AGENT_NAME: agentName,
          AGENTHUB_AGENT_REPO: repoName,
        },
      },
    },
  }

  const filePath = configPath(targetDir, agentId)
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
  return filePath
}

export function cleanupCodexMcpConfig(targetDir: string, agentId: string): void {
  const filePath = configPath(targetDir, agentId)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}
