import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentStore } from './agent-store'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    taskDescription: 'Fix the login bug',
    pid: 1234,
    ptyFd: null,
    cwd: '/Users/dev/project',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    progress: 0.5,
    color: '#3B82F6',
    ...overrides
  }
}

describe('useAgentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: new Map(),
      activeAgentId: null
    })
  })

  describe('addAgent', () => {
    it('adds agent to the map and sets it as active', () => {
      const agent = createMockAgent()
      useAgentStore.getState().addAgent(agent)
      expect(useAgentStore.getState().agents.get('agent-1')).toEqual(agent)
      expect(useAgentStore.getState().activeAgentId).toBe('agent-1')
    })
  })

  describe('removeAgent', () => {
    it('removes agent from the map', () => {
      const agent = createMockAgent()
      useAgentStore.getState().addAgent(agent)
      useAgentStore.getState().removeAgent('agent-1')
      expect(useAgentStore.getState().agents.has('agent-1')).toBe(false)
    })

    it('clears activeAgentId when removed agent was active', () => {
      const agent = createMockAgent()
      useAgentStore.getState().addAgent(agent)
      useAgentStore.getState().removeAgent('agent-1')
      expect(useAgentStore.getState().activeAgentId).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('updates the status and confidence of an existing agent', () => {
      useAgentStore.getState().addAgent(createMockAgent())
      useAgentStore.getState().updateStatus('agent-1', 'paused', 'confirmed')
      const agent = useAgentStore.getState().agents.get('agent-1')
      expect(agent?.status).toBe('paused')
      expect(agent?.confidence).toBe('confirmed')
    })

    it('returns unchanged state when agent does not exist', () => {
      const before = useAgentStore.getState().agents
      useAgentStore.getState().updateStatus('nonexistent', 'paused', 'confirmed')
      expect(useAgentStore.getState().agents).toBe(before)
    })
  })

  describe('updateColor', () => {
    it('updates the color of an existing agent', () => {
      useAgentStore.getState().addAgent(createMockAgent())
      useAgentStore.getState().updateColor('agent-1', '#EF4444')
      const agent = useAgentStore.getState().agents.get('agent-1')
      expect(agent?.color).toBe('#EF4444')
    })

    it('updates the updatedAt timestamp', () => {
      useAgentStore.getState().addAgent(createMockAgent())
      const before = useAgentStore.getState().agents.get('agent-1')?.updatedAt
      useAgentStore.getState().updateColor('agent-1', '#10B981')
      const after = useAgentStore.getState().agents.get('agent-1')?.updatedAt
      expect(after).not.toBe(before)
    })

    it('returns unchanged state when agent does not exist', () => {
      const before = useAgentStore.getState().agents
      useAgentStore.getState().updateColor('nonexistent', '#EF4444')
      expect(useAgentStore.getState().agents).toBe(before)
    })

    it('preserves other agent fields when updating color', () => {
      const original = createMockAgent()
      useAgentStore.getState().addAgent(original)
      useAgentStore.getState().updateColor('agent-1', '#8B5CF6')
      const updated = useAgentStore.getState().agents.get('agent-1')!
      expect(updated.name).toBe(original.name)
      expect(updated.status).toBe(original.status)
      expect(updated.model).toBe(original.model)
      expect(updated.color).toBe('#8B5CF6')
    })
  })

  describe('hydrateAgents', () => {
    it('replaces the entire agent map', () => {
      const agents = [
        createMockAgent({ id: 'a1', name: 'agent-a' }),
        createMockAgent({ id: 'a2', name: 'agent-b' })
      ]
      useAgentStore.getState().hydrateAgents(agents)
      expect(useAgentStore.getState().agents.size).toBe(2)
      expect(useAgentStore.getState().agents.get('a1')?.name).toBe('agent-a')
      expect(useAgentStore.getState().agents.get('a2')?.name).toBe('agent-b')
    })
  })
})
