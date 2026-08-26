import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { generateAgentsMd } from './agents-md-generator'
import { writeCodexMcpConfig, cleanupCodexMcpConfig } from './codex-mcp-config'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codex-e2e-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Codex skill injection — end-to-end', () => {
  it('generates AGENTS.md with guard, skills, and task, then writes MCP config', () => {
    // Setup: create guard and skills files
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, '# Guard Policy\n\nI cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills-index.md')
    writeFileSync(skillsPath, '# Skills\n- brainstorm\n- dev-loop\n')

    // Step 1: Generate AGENTS.md
    const agentsMd = generateAgentsMd({
      guardPath,
      skillsIndexPath: skillsPath,
      taskDescription: 'Fix the auth flow in login.ts',
    })

    // Verify AGENTS.md content
    expect(agentsMd).toContain('Codex CLI')
    expect(agentsMd).toContain('Guard Policy')
    expect(agentsMd).toContain('I cannot assist with that request')
    expect(agentsMd).toContain('brainstorm')
    expect(agentsMd).toContain('dev-loop')
    expect(agentsMd).toContain('Fix the auth flow in login.ts')

    // Step 2: Write AGENTS.md to .codex/ directory
    const codexDir = join(tempDir, '.codex')
    const { mkdirSync } = require('fs')
    mkdirSync(codexDir, { recursive: true })
    const agentsMdPath = join(codexDir, 'AGENTS.md')
    writeFileSync(agentsMdPath, agentsMd, 'utf-8')
    expect(existsSync(agentsMdPath)).toBe(true)
    expect(readFileSync(agentsMdPath, 'utf-8')).toBe(agentsMd)

    // Step 3: Write MCP config
    const mcpPath = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'e2e-agent',
      agentName: 'test-worker',
      repoName: 'agenthub',
      telegramSocketPath: '/tmp/telegram.sock',
      telegramScriptPath: '/path/to/telegram/index.js',
    })

    expect(mcpPath).not.toBeNull()
    const mcpContent = JSON.parse(readFileSync(mcpPath!, 'utf-8'))
    expect(mcpContent.mcpServers['agenthub-telegram'].env.AGENTHUB_AGENT_ID).toBe('e2e-agent')

    // Step 4: Cleanup
    cleanupCodexMcpConfig(tempDir, 'e2e-agent')
    expect(existsSync(mcpPath!)).toBe(false)

    // AGENTS.md cleanup
    rmSync(agentsMdPath)
    expect(existsSync(agentsMdPath)).toBe(false)
  })

  it('guard integrity blocks injection when guard is tampered', () => {
    const guardPath = join(tempDir, 'tampered-guard.md')
    writeFileSync(guardPath, '# Tampered guard without refusal phrase\n')
    const skillsPath = join(tempDir, 'skills.md')
    writeFileSync(skillsPath, '# Skills\n')

    expect(() =>
      generateAgentsMd({ guardPath, skillsIndexPath: skillsPath })
    ).toThrow(/integrity/)
  })

  it('works without telegram socket (MCP config returns null)', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'Guard. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills.md')
    writeFileSync(skillsPath, '# Skills\n')

    const agentsMd = generateAgentsMd({ guardPath, skillsIndexPath: skillsPath })
    expect(agentsMd).toContain('Guard')

    const mcpPath = writeCodexMcpConfig({
      targetDir: tempDir,
      agentId: 'no-telegram',
      agentName: 'worker',
      repoName: 'repo',
      telegramSocketPath: null,
      telegramScriptPath: '/path/to/index.js',
    })
    expect(mcpPath).toBeNull()
  })

  it('section ordering matches Codex priority: guard before skills before task', () => {
    const guardPath = join(tempDir, 'guard.md')
    writeFileSync(guardPath, 'GUARD_MARKER. I cannot assist with that request.\n')
    const skillsPath = join(tempDir, 'skills.md')
    writeFileSync(skillsPath, 'SKILLS_MARKER\n')

    const agentsMd = generateAgentsMd({
      guardPath,
      skillsIndexPath: skillsPath,
      taskDescription: 'TASK_MARKER',
    })

    const guardIdx = agentsMd.indexOf('GUARD_MARKER')
    const skillsIdx = agentsMd.indexOf('SKILLS_MARKER')
    const taskIdx = agentsMd.indexOf('TASK_MARKER')

    expect(guardIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(guardIdx)
    expect(taskIdx).toBeGreaterThan(skillsIdx)
  })
})
