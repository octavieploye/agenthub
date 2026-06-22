import { describe, it, expect, vi, afterEach } from 'vitest'
import { TtsQueue } from './tts-queue'

describe('TtsQueue', () => {
  let speakFn: ReturnType<typeof vi.fn>
  let queue: TtsQueue

  afterEach(() => {
    queue?.clear()
  })

  it('speaks a single item immediately', async () => {
    speakFn = vi.fn().mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('Hello')
    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledWith('Hello'))
  })

  it('serializes multiple items — second waits for first', async () => {
    let resolve1!: () => void
    const p1 = new Promise<void>((r) => { resolve1 = r })
    speakFn = vi.fn().mockReturnValueOnce(p1).mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('First')
    queue.enqueue('Second')

    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(1))
    expect(speakFn).toHaveBeenCalledWith('First')

    resolve1()
    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(2))
    expect(speakFn).toHaveBeenCalledWith('Second')
  })

  it('clear() stops pending items from being spoken', async () => {
    let resolve1!: () => void
    const p1 = new Promise<void>((r) => { resolve1 = r })
    speakFn = vi.fn().mockReturnValueOnce(p1).mockResolvedValue(undefined)
    queue = new TtsQueue(speakFn)

    queue.enqueue('First')
    queue.enqueue('Second')
    queue.enqueue('Third')

    queue.clear()
    resolve1()

    await new Promise((r) => setTimeout(r, 50))
    expect(speakFn).toHaveBeenCalledTimes(1)
  })

  it('pending count reflects queued items', () => {
    speakFn = vi.fn().mockReturnValue(new Promise(() => {}))
    queue = new TtsQueue(speakFn)

    queue.enqueue('A')
    queue.enqueue('B')
    queue.enqueue('C')
    expect(queue.pending).toBe(2)
  })

  it('handles speak errors gracefully — continues to next item', async () => {
    speakFn = vi.fn()
      .mockRejectedValueOnce(new Error('piper crash'))
      .mockResolvedValueOnce(undefined)
    queue = new TtsQueue(speakFn)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    queue.enqueue('Will fail')
    queue.enqueue('Will succeed')

    await vi.waitFor(() => expect(speakFn).toHaveBeenCalledTimes(2))
    expect(speakFn).toHaveBeenCalledWith('Will succeed')
    warnSpy.mockRestore()
  })
})
