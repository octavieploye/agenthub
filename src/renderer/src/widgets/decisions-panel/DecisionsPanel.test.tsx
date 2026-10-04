import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DecisionsPanel from './DecisionsPanel'
import { useDecisionsStore } from './decisions-store'
import { useViewStore } from '@renderer/stores/view-store'
import {
  DECISION_STATUS_LABELS,
  type DecisionItem,
  type DecisionsResult
} from '@shared/types/decisions.types'

const list = vi.fn()

function decision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id: 'd-1',
    project_id: 'p-1',
    domain: 'code',
    title: 'Use SQLite for local storage',
    summary: 'Local first, no server',
    rationale: null,
    status: 'done',
    owner_entity: 'hephaestus',
    decided_by: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    decided_at: null,
    supersedes_id: null,
    ethical_review_id: null,
    ...overrides
  }
}

function mockResult(result: DecisionsResult): void {
  list.mockResolvedValue(result)
}

const REPO_ID = 'repo-1'

beforeEach(() => {
  list.mockReset()
  useDecisionsStore.getState().reset()
  useViewStore.setState({ selectedRepoId: REPO_ID })
  Object.defineProperty(window, 'agentHub', {
    value: { decisions: { list } },
    writable: true,
    configurable: true
  })
})

describe('DecisionsPanel', () => {
  it('calls window.agentHub.decisions.list on mount with exactly the selected repo id', async () => {
    mockResult({ state: 'ok', decisions: [], statuses: [] })
    render(<DecisionsPanel />)
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(list).toHaveBeenCalledWith({ repoId: REPO_ID, domain: undefined })
    expect(list.mock.calls[0][0]).toEqual({ repoId: REPO_ID })
  })

  it('with no repo selected: shows the select-a-repo message, makes no IPC call, disables Refresh', async () => {
    useViewStore.setState({ selectedRepoId: null })
    mockResult({ state: 'ok', decisions: [], statuses: [] })
    render(<DecisionsPanel />)

    expect(screen.getByTestId('decisions-no-repo')).toHaveTextContent(
      'Select a repository to see its shared decisions.'
    )
    expect(screen.queryByText(/unavailable/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await act(async () => {})
    expect(list).not.toHaveBeenCalled()
  })

  it('clears the previous repo rows immediately on a repo switch', async () => {
    list.mockResolvedValueOnce({
      state: 'ok',
      decisions: [decision({ id: 'a', title: 'Repo one decision' })],
      statuses: []
    })
    render(<DecisionsPanel />)
    expect(await screen.findByText('Repo one decision')).toBeInTheDocument()

    let resolveSecond: (value: DecisionsResult) => void = () => {}
    list.mockReturnValueOnce(
      new Promise<DecisionsResult>((resolve) => {
        resolveSecond = resolve
      })
    )
    act(() => useViewStore.setState({ selectedRepoId: 'repo-2' }))

    expect(screen.queryByText('Repo one decision')).toBeNull()
    expect(screen.getByText(/loading decisions/i)).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith({ repoId: 'repo-2', domain: undefined })

    await act(async () => {
      resolveSecond({
        state: 'ok',
        decisions: [decision({ id: 'b', title: 'Repo two decision' })],
        statuses: []
      })
    })
    expect(await screen.findByText('Repo two decision')).toBeInTheDocument()
  })

  it('renders one row per decision with its title', async () => {
    mockResult({
      state: 'ok',
      decisions: [
        decision({ id: '1', title: 'Use SQLite for local storage' }),
        decision({ id: '2', title: 'Ship the panel read-only', status: 'in_progress' })
      ],
      statuses: []
    })
    render(<DecisionsPanel />)
    expect(await screen.findByText('Use SQLite for local storage')).toBeInTheDocument()
    expect(screen.getByText('Ship the panel read-only')).toBeInTheDocument()
  })

  it('shows the human status label of each decision', async () => {
    mockResult({
      state: 'ok',
      decisions: [
        decision({ id: '1', title: 'Row draft', status: 'draft' }),
        decision({ id: '2', title: 'Row pending', status: 'pending' }),
        decision({ id: '3', title: 'Row progress', status: 'in_progress' }),
        decision({ id: '4', title: 'Row done', status: 'done' }),
        decision({ id: '5', title: 'Row rejected', status: 'rejected' }),
        decision({ id: '6', title: 'Row superseded', status: 'superseded' })
      ],
      statuses: []
    })
    render(<DecisionsPanel />)
    await screen.findByText('Row draft')
    expect(DECISION_STATUS_LABELS.draft).toBe('Draft')
    expect(DECISION_STATUS_LABELS.pending).toBe('Needs more data')
    expect(DECISION_STATUS_LABELS.in_progress).toBe('In progress')
    expect(DECISION_STATUS_LABELS.done).toBe('Completed')
    expect(DECISION_STATUS_LABELS.rejected).toBe('Rejected')
    expect(DECISION_STATUS_LABELS.superseded).toBe('Replaced')
    for (const label of [
      'Draft',
      'Needs more data',
      'In progress',
      'Completed',
      'Rejected',
      'Replaced'
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('renders decision text as text: no script or HTML element is injected', async () => {
    const evil =
      '<script>window.__pwned = true</script><b>bold</b><img src=x onerror="window.__pwned=true">'
    mockResult({
      state: 'ok',
      decisions: [decision({ title: evil, summary: '<i>italic</i>' })],
      statuses: []
    })
    const { container } = render(<DecisionsPanel />)

    expect(await screen.findByText(evil)).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('i')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined()
  })

  it('shows an empty message when there are no decisions', async () => {
    mockResult({ state: 'ok', decisions: [], statuses: [] })
    render(<DecisionsPanel />)
    expect(await screen.findByText(/no decisions/i)).toBeInTheDocument()
  })

  it.each<[string, DecisionsResult, RegExp]>([
    ['standalone', { state: 'standalone' }, /standalone/i],
    ['maintenance', { state: 'maintenance' }, /Anamnesis in maintenance/i],
    ['unauthorized', { state: 'unauthorized' }, /unauthori[sz]ed|not authori[sz]ed/i],
    ['unavailable', { state: 'unavailable' }, /unavailable/i]
  ])('renders the %s state with its own message', async (_name, result, expected) => {
    mockResult(result)
    render(<DecisionsPanel />)
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('gives every state a distinct text', async () => {
    const results: DecisionsResult[] = [
      { state: 'ok', decisions: [], statuses: [] },
      { state: 'standalone' },
      { state: 'maintenance' },
      { state: 'unauthorized' },
      { state: 'unavailable' }
    ]
    const texts: string[] = []
    for (const result of results) {
      mockResult(result)
      const { container, unmount } = render(<DecisionsPanel />)
      await waitFor(() => expect(list).toHaveBeenCalled())
      await waitFor(() => expect(container.textContent ?? '').not.toMatch(/loading/i))
      texts.push(container.textContent ?? '')
      unmount()
      list.mockClear()
    }
    expect(new Set(texts).size).toBe(results.length)
  })
})

describe('decisions-store', () => {
  it.each(['', '   ', '\t\n'])('refresh(%j) makes no IPC call and sets no result', async (repoId) => {
    await useDecisionsStore.getState().refresh(repoId)
    expect(list).not.toHaveBeenCalled()
    expect(useDecisionsStore.getState().result).toBeNull()
    expect(useDecisionsStore.getState().loading).toBe(false)
  })

  it.each<[string, unknown]>([
    ['decisions is not an array', { state: 'ok', decisions: 'nope', statuses: [] }],
    ['statuses is not an array', { state: 'ok', decisions: [], statuses: {} }],
    ['decisions is missing', { state: 'ok', statuses: [] }],
    ['statuses is null', { state: 'ok', decisions: [], statuses: null }]
  ])('maps an ok result where %s to unavailable', async (_name, malformed) => {
    list.mockResolvedValue(malformed)
    await useDecisionsStore.getState().refresh(REPO_ID)
    expect(useDecisionsStore.getState().result).toEqual({ state: 'unavailable' })
  })

  it('maps a non-object result to unavailable', async () => {
    list.mockResolvedValue(undefined)
    await useDecisionsStore.getState().refresh(REPO_ID)
    expect(useDecisionsStore.getState().result).toEqual({ state: 'unavailable' })
  })

  it('keeps a well-formed ok result untouched', async () => {
    const ok: DecisionsResult = { state: 'ok', decisions: [decision()], statuses: [] }
    list.mockResolvedValue(ok)
    await useDecisionsStore.getState().refresh(REPO_ID)
    expect(useDecisionsStore.getState().result).toEqual(ok)
  })

  it('is last-request-wins: a slow earlier response never overwrites a newer one', async () => {
    let resolveSlow: (value: DecisionsResult) => void = () => {}
    list.mockReturnValueOnce(
      new Promise<DecisionsResult>((resolve) => {
        resolveSlow = resolve
      })
    )
    list.mockResolvedValueOnce({ state: 'standalone' })
    const slow = useDecisionsStore.getState().refresh('repo-a')
    await useDecisionsStore.getState().refresh('repo-b')
    resolveSlow({ state: 'maintenance' })
    await slow
    expect(useDecisionsStore.getState().result).toEqual({ state: 'standalone' })
  })
})
