import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useEffect, useRef, type ReactElement } from 'react'
import { VoiceInputProvider, useVoiceInputContext } from './VoiceInputContext'
import { useViewStore } from '../stores/view-store'

/**
 * Registers one input into the voice context, mirroring what VoiceInputButton does.
 * `toggle` stands in for the recorder toggle so we can assert where Cmd+E landed.
 */
function Pane({
  id,
  ownerId,
  toggle,
  disabled = false,
  canDictate = true
}: {
  id: string
  ownerId?: string
  toggle: () => void
  disabled?: boolean
  canDictate?: boolean
}): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const { register, unregister } = useVoiceInputContext()

  useEffect(() => {
    register(id, { inputRef, toggleFn: toggle, ownerId, canDictate })
    return () => unregister(id)
  }, [id, ownerId, toggle, canDictate, register, unregister])

  return <input ref={inputRef} data-testid={id} disabled={disabled} />
}

function pressVoiceKey(): void {
  fireEvent.keyDown(window, { key: 'e', metaKey: true })
}

describe('VoiceInputContext — Cmd+E routing', () => {
  beforeEach(() => {
    useViewStore.setState({ focusedAgentId: null })
  })

  it('routes to the input that currently has focus', () => {
    const toggleA = vi.fn()
    const toggleB = vi.fn()
    const { getByTestId } = render(
      <VoiceInputProvider>
        <Pane id="a" ownerId="agent-a" toggle={toggleA} />
        <Pane id="b" ownerId="agent-b" toggle={toggleB} />
      </VoiceInputProvider>
    )

    getByTestId('a').focus()
    pressVoiceKey()

    expect(toggleA).toHaveBeenCalledTimes(1)
    expect(toggleB).not.toHaveBeenCalled()
  })

  it('routes to the focused agent pane when no input holds DOM focus', () => {
    const toggleA = vi.fn()
    const toggleB = vi.fn()
    useViewStore.setState({ focusedAgentId: 'agent-a' })
    render(
      <VoiceInputProvider>
        <Pane id="a" ownerId="agent-a" toggle={toggleA} />
        <Pane id="b" ownerId="agent-b" toggle={toggleB} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).toHaveBeenCalledTimes(1)
    expect(toggleB).not.toHaveBeenCalled()
  })

  it('does not misroute to an unrelated pane when the target is ambiguous', () => {
    const toggleA = vi.fn()
    const toggleB = vi.fn()
    render(
      <VoiceInputProvider>
        <Pane id="a" ownerId="agent-a" toggle={toggleA} />
        <Pane id="b" ownerId="agent-b" toggle={toggleB} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).not.toHaveBeenCalled()
    expect(toggleB).not.toHaveBeenCalled()
  })

  it('routes to the sole registration when only one input exists', () => {
    const toggleA = vi.fn()
    render(
      <VoiceInputProvider>
        <Pane id="a" toggle={toggleA} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).toHaveBeenCalledTimes(1)
  })

  it('routes to a dictatable target even when its text input is disabled', () => {
    const toggleA = vi.fn()
    render(
      <VoiceInputProvider>
        <Pane id="a" toggle={toggleA} disabled />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).toHaveBeenCalledTimes(1)
  })

  it('routes to the focused agent when its text input is disabled but dictation is allowed', () => {
    const toggleA = vi.fn()
    const toggleB = vi.fn()
    useViewStore.setState({ focusedAgentId: 'agent-a' })
    render(
      <VoiceInputProvider>
        <Pane id="a" ownerId="agent-a" toggle={toggleA} disabled />
        <Pane id="b" ownerId="agent-b" toggle={toggleB} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).toHaveBeenCalledTimes(1)
    expect(toggleB).not.toHaveBeenCalled()
  })

  it('does not target an explicitly ineligible voice destination', () => {
    const toggleA = vi.fn()
    render(
      <VoiceInputProvider>
        <Pane id="a" toggle={toggleA} canDictate={false} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).not.toHaveBeenCalled()
  })

  it('does not fall through to another agent when the focused destination is ineligible', () => {
    const toggleA = vi.fn()
    const toggleB = vi.fn()
    useViewStore.setState({ focusedAgentId: 'agent-a' })
    render(
      <VoiceInputProvider>
        <Pane id="a" ownerId="agent-a" toggle={toggleA} canDictate={false} />
        <Pane id="b" ownerId="agent-b" toggle={toggleB} />
      </VoiceInputProvider>
    )

    pressVoiceKey()

    expect(toggleA).not.toHaveBeenCalled()
    expect(toggleB).not.toHaveBeenCalled()
  })
})
