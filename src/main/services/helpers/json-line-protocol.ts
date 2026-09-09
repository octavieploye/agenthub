export function createJsonLineParser(
  onMessage: (msg: unknown) => void,
  onError?: (raw: string, err: Error) => void
): (chunk: Buffer) => void {
  let buf = ''

  return function handleChunk(chunk: Buffer): void {
    buf += chunk.toString()
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim() === '') continue
      try {
        onMessage(JSON.parse(line))
      } catch (err) {
        if (onError) {
          onError(line, err as Error)
        } else {
          console.error('[json-line-protocol] malformed JSON:', line, err)
        }
      }
    }
  }
}
