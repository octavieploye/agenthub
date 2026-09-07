import { describe, it, expect } from 'vitest'
import type { AgentState, AgentSpawnOptions } from './agent.types'
import { IPC_CHANNELS } from '../constants/ipc-channels'

describe('AgentState — claudeSessionId field', () => {
  it('allows constructing AgentState with claudeSessionId', () => {
    const agent: AgentState = {
      id: 'test-id',
      repoId: 'repo-1',
      name: 'test-agent',
      status: 'completed',
      confidence: 'confirmed',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      effortLevel: 'medium',
      taskDescription: 'test',
      pid: null,
      ptyFd: null,
      cwd: '/tmp',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      progress: 0,
      color: '#3B82F6',
      executionMode: 'native',
      voiceMode: 'off',
      telegramNotify: false,
      claudeSessionId: 'test-uuid'
    }
    expect(agent.claudeSessionId).toBe('test-uuid')
  })

  it('allows claudeSessionId to be null', () => {
    const agent: AgentState = {
      id: 'test-id',
      repoId: 'repo-1',
      name: 'test-agent',
      status: 'completed',
      confidence: 'confirmed',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      effortLevel: 'medium',
      taskDescription: 'test',
      pid: null,
      ptyFd: null,
      cwd: '/tmp',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      progress: 0,
      color: '#3B82F6',
      executionMode: 'native',
      voiceMode: 'off',
      telegramNotify: false,
      claudeSessionId: null
    }
    expect(agent.claudeSessionId).toBeNull()
  })

  it('allows constructing AgentState without claudeSessionId (optional)', () => {
    const agent: AgentState = {
      id: 'test-id',
      repoId: 'repo-1',
      name: 'test-agent',
      status: 'completed',
      confidence: 'confirmed',
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      effortLevel: 'medium',
      taskDescription: 'test',
      pid: null,
      ptyFd: null,
      cwd: '/tmp',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      progress: 0,
      color: '#3B82F6',
      executionMode: 'native',
      voiceMode: 'off',
      telegramNotify: false
    }
    expect(agent.claudeSessionId).toBeUndefined()
  })
})

describe('AgentSpawnOptions — resumeSessionId field', () => {
  it('allows constructing AgentSpawnOptions with resumeSessionId', () => {
    const opts: AgentSpawnOptions = {
      repoId: 'repo-1',
      name: 'agent',
      cwd: '/tmp',
      resumeSessionId: 'abc-uuid-test'
    }
    expect(opts.resumeSessionId).toBe('abc-uuid-test')
  })

  it('allows AgentSpawnOptions without resumeSessionId (optional)', () => {
    const opts: AgentSpawnOptions = {
      repoId: 'repo-1',
      name: 'agent',
      cwd: '/tmp'
    }
    expect(opts.resumeSessionId).toBeUndefined()
  })
})

describe('IPC_CHANNELS.AGENTS — LIST_ALL channel', () => {
  it('has LIST_ALL channel defined', () => {
    expect(IPC_CHANNELS.AGENTS.LIST_ALL).toBe('agents:list-all')
  })
})
