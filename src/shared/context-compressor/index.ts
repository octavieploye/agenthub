import { createHash } from 'node:crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export type SegmentType = 'JSON' | 'CODE' | 'TEXT'

export interface CcrEntry {
  id: string
  type: SegmentType
  summary: string
  originalSize: number
}

export interface CompressResult {
  output: string
  originalChars: number
  compressedChars: number
  /** Fraction of original size retained (lower = more compressed) */
  ratio: number
  ccrEntries: CcrEntry[]
  dynamicFields: string[]
}

export interface CompressOptions {
  /** Trigger CCR marker when compressed chars fall below this fraction of original. Default: 0.4 */
  ccrThreshold?: number
  /** Hint about what the context is used for — improves JSON field relevance scoring */
  queryHint?: string
}

// ── CCR Store (in-memory; swap for better-sqlite3 in main process if needed) ──

const _store = new Map<string, string>()

function storeOriginal(content: string): string {
  const id = createHash('sha1').update(content).digest('hex').slice(0, 6)
  _store.set(id, content)
  return id
}

/** Retrieve original content by CCR id. Returns undefined if not found. */
export function retrieveOriginal(id: string): string | undefined {
  return _store.get(id)
}

// ── Dynamic Field Extraction ───────────────────────────────────────────────

const RE_ISO_DATE = /\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?)\b/g
const RE_UUID     = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi
const RE_TOKEN    = /(?:token|session|key|secret|api_key)\s*[:=]\s*["']?([A-Za-z0-9_\-.]{20,})["']?/gi

function extractDynamic(input: string): { text: string; fields: string[] } {
  const fields: string[] = []
  let text = input

  text = text.replace(RE_ISO_DATE, (_, v) => { fields.push(`date: ${v}`);  return '[DATE]'  })
  text = text.replace(RE_UUID,     (_, v) => { fields.push(`uuid: ${v}`);  return '[UUID]'  })
  text = text.replace(RE_TOKEN,    (_, v) => { fields.push(`token: ${v}`); return '[TOKEN]' })

  return { text, fields }
}

// ── Text Compressor ────────────────────────────────────────────────────────

const FILLER: RegExp[] = [
  /\bIn order to\b/gi,
  /\bIt is important to note that\b/gi,
  /\bAs mentioned above\b/gi,
  /\bPlease be aware(?: that)?\b/gi,
  /\bIt should be noted that\b/gi,
  /\bDue to the fact that\b/gi,
  /\bIn the event that\b/gi,
  /\bAt this point in time\b/gi,
  /\bFor the purposes of\b/gi,
]

function compressText(input: string): string {
  let out = input
  for (const p of FILLER) out = out.replace(p, '')
  // Shorten verbose headers to 5 words max
  out = out.replace(/^(#{1,3})\s+(.+)$/gm, (_, h, t) =>
    `${h} ${t.trim().split(/\s+/).slice(0, 5).join(' ')}`
  )
  // Collapse 3+ blank lines to 1
  out = out.replace(/\n{3,}/g, '\n\n')
  // Strip trailing whitespace per line
  out = out.replace(/[ \t]+$/gm, '')
  return out.trim()
}

// ── JSON Compressor ────────────────────────────────────────────────────────

function compressJson(input: string, queryHint = ''): string {
  let parsed: unknown
  try { parsed = JSON.parse(input) } catch { return input }

  const hint = queryHint.toLowerCase()

  function compress(val: unknown, depth = 0): unknown {
    if (Array.isArray(val)) {
      if (val.length > 5) return [compress(val[0], depth + 1), `...${val.length - 1} more`]
      return val.map(v => compress(v, depth + 1))
    }
    if (val !== null && typeof val === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        // Skip null / empty defaults unless query-relevant
        if (v === null || v === '') continue
        if ((v === false || v === 0) && !hint.includes(k.toLowerCase())) continue
        // Flatten nesting deeper than 2 levels to dot-notation
        if (depth >= 2 && typeof v === 'object' && v !== null && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>))
            out[`${k}.${sk}`] = compress(sv, depth + 1)
        } else {
          out[k] = compress(v, depth + 1)
        }
      }
      return out
    }
    return val
  }

  return JSON.stringify(compress(parsed), null, 2)
}

// ── Code Compressor ────────────────────────────────────────────────────────

function compressCode(input: string): string {
  // Strip fenced code block markers if wrapping the whole input
  const unwrapped = input.replace(/^```[\w]*\n?([\s\S]*?)```$/m, '$1').trim()
  const lines = unwrapped.split('\n')
  const out: string[] = []
  let prevBlank = false
  let inBlock = false

  for (const line of lines) {
    const t = line.trim()

    if (inBlock) {
      if (t.includes('*/')) inBlock = false
      continue
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true
      continue
    }
    // Single-line comments (preserve inline comments after code)
    if (t.startsWith('//') || t.startsWith('#!') || (t.startsWith('#') && !/^#\s*\w/.test(t))) continue

    const blank = t === ''
    if (blank) {
      if (!prevBlank) out.push('')
      prevBlank = true
      continue
    }
    prevBlank = false
    out.push(line)
  }

  return out.join('\n').trim()
}

// ── Classifier ─────────────────────────────────────────────────────────────

const CODE_SIGNALS = /\b(function|const|let|var|import|export|class|interface|type |def |fn |pub fn|async |await |return |=>)\b/

function classify(input: string): SegmentType {
  const t = input.trim()
  if ((t.startsWith('{') || t.startsWith('[')) && isValidJson(t)) return 'JSON'
  if (/^```/.test(t) || CODE_SIGNALS.test(t)) return 'CODE'
  return 'TEXT'
}

function isValidJson(s: string): boolean {
  try { JSON.parse(s); return true } catch { return false }
}

// ── Main API ───────────────────────────────────────────────────────────────

/**
 * Compress a context string using Headroom strategies:
 * 1. Extract dynamic fields (dates, UUIDs, tokens) → move to end for cache alignment
 * 2. Classify content type (JSON / CODE / TEXT)
 * 3. Apply per-type compression
 * 4. Add CCR marker if compression is aggressive (preserves retrievability)
 * 5. Assemble: static content → dynamic fields → CCR registry → summary
 */
export function compressContext(input: string, options: CompressOptions = {}): CompressResult {
  const { ccrThreshold = 0.4, queryHint = '' } = options

  if (input.length === 0) {
    return { output: '# ALREADY OPTIMAL', originalChars: 0, compressedChars: 16, ratio: 1, ccrEntries: [], dynamicFields: [] }
  }

  const originalChars = input.length
  const { text: stripped, fields: dynamicFields } = extractDynamic(input)
  const segType = classify(stripped)

  let compressed: string
  switch (segType) {
    case 'JSON': compressed = compressJson(stripped, queryHint); break
    case 'CODE': compressed = compressCode(stripped);             break
    default:     compressed = compressText(stripped);             break
  }

  // Early exit: already small and no dynamic fields → return as-is
  if (originalChars <= 500 && dynamicFields.length === 0) {
    return {
      output: `# ALREADY OPTIMAL\n\n${input}`,
      originalChars,
      compressedChars: input.length,
      ratio: 1,
      ccrEntries: [],
      dynamicFields: [],
    }
  }

  const ccrEntries: CcrEntry[] = []
  const compressedRatio = compressed.length / Math.max(stripped.length, 1)

  if (compressedRatio < ccrThreshold) {
    const id = storeOriginal(input)
    const summary = compressed.slice(0, 80).replace(/\n/g, ' ') + '…'
    ccrEntries.push({ id, type: segType, summary, originalSize: originalChars })
    compressed = `[CCR:${segType}:${id}] ${summary}`
  }

  // Assemble output
  const parts: string[] = [compressed]

  if (dynamicFields.length > 0) {
    parts.push('\n## Dynamic Fields')
    parts.push(dynamicFields.map(f => `- ${f}`).join('\n'))
  }

  if (ccrEntries.length > 0) {
    parts.push('\n## CCR Registry')
    parts.push('| ID | Type | Summary | Original size |')
    parts.push('|---|---|---|---|')
    for (const e of ccrEntries)
      parts.push(`| \`${e.id}\` | ${e.type} | ${e.summary} | ${e.originalSize} chars |`)
  }

  const reductionPct = Math.round((1 - compressed.length / originalChars) * 100)
  parts.push(`\n---\n# SUMMARY: ${segType} context | Compression: ~${reductionPct}% token reduction`)

  const output = parts.join('\n')

  return {
    output,
    originalChars,
    compressedChars: output.length,
    ratio: output.length / originalChars,
    ccrEntries,
    dynamicFields,
  }
}
