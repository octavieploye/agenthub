#!/usr/bin/env node
/**
 * compress-context.mjs — Headroom Context Optimizer
 *
 * Standalone, zero-dependency Node.js script.
 * Copy to any project and run with:
 *   node compress-context.mjs <file>
 *   cat file.md | node compress-context.mjs
 *   node compress-context.mjs --help
 *
 * Implements 5 Headroom strategies:
 *   1. Dynamic field extraction (cache alignment)
 *   2. Content classification (JSON / CODE / TEXT)
 *   3. Per-type compression
 *   4. CCR markers for reversible aggressive compression
 *   5. Provenance metadata in output
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// ── CCR Store ──────────────────────────────────────────────────────────────

const _store = new Map()

function storeOriginal(content) {
  const id = createHash('sha1').update(content).digest('hex').slice(0, 6)
  _store.set(id, content)
  return id
}

export function retrieveOriginal(id) {
  return _store.get(id)
}

// ── Dynamic Field Extraction ───────────────────────────────────────────────

const RE_ISO_DATE = /\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?)\b/g
const RE_UUID     = /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi
const RE_TOKEN    = /(?:token|session|key|secret|api_key)\s*[:=]\s*["']?([A-Za-z0-9_\-.]{20,})["']?/gi

function extractDynamic(input) {
  const fields = []
  let text = input

  text = text.replace(RE_ISO_DATE, (_, v) => { fields.push(`date: ${v}`);  return '[DATE]'  })
  text = text.replace(RE_UUID,     (_, v) => { fields.push(`uuid: ${v}`);  return '[UUID]'  })
  text = text.replace(RE_TOKEN,    (_, v) => { fields.push(`token: ${v}`); return '[TOKEN]' })

  return { text, fields }
}

// ── Text Compressor ────────────────────────────────────────────────────────

const FILLER = [
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

function compressText(input) {
  let out = input
  for (const p of FILLER) out = out.replace(p, '')
  out = out.replace(/^(#{1,3})\s+(.+)$/gm, (_, h, t) =>
    `${h} ${t.trim().split(/\s+/).slice(0, 5).join(' ')}`
  )
  out = out.replace(/\n{3,}/g, '\n\n')
  out = out.replace(/[ \t]+$/gm, '')
  return out.trim()
}

// ── JSON Compressor ────────────────────────────────────────────────────────

function compressJson(input, queryHint = '') {
  let parsed
  try { parsed = JSON.parse(input) } catch { return input }

  const hint = queryHint.toLowerCase()

  function compress(val, depth = 0) {
    if (Array.isArray(val)) {
      if (val.length > 5) return [compress(val[0], depth + 1), `...${val.length - 1} more`]
      return val.map(v => compress(v, depth + 1))
    }
    if (val !== null && typeof val === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(val)) {
        if (v === null || v === '') continue
        if ((v === false || v === 0) && !hint.includes(k.toLowerCase())) continue
        if (depth >= 2 && typeof v === 'object' && v !== null && !Array.isArray(v)) {
          for (const [sk, sv] of Object.entries(v))
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

function compressCode(input) {
  const unwrapped = input.replace(/^```[\w]*\n?([\s\S]*?)```$/m, '$1').trim()
  const lines = unwrapped.split('\n')
  const out = []
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
    if (t.startsWith('//') || (t.startsWith('#') && !/^#\s*\w/.test(t))) continue

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

const CODE_SIGNALS = /\b(function|const|let|var|import|export|class|interface|def |fn |pub fn|async |await |return |=>)\b/

function classify(input) {
  const t = input.trim()
  if ((t.startsWith('{') || t.startsWith('[')) && isValidJson(t)) return 'JSON'
  if (/^```/.test(t) || CODE_SIGNALS.test(t)) return 'CODE'
  return 'TEXT'
}

function isValidJson(s) {
  try { JSON.parse(s); return true } catch { return false }
}

// ── Main API ───────────────────────────────────────────────────────────────

export function compressContext(input, options = {}) {
  const { ccrThreshold = 0.4, queryHint = '' } = options

  if (!input || input.length === 0) {
    return { output: '# ALREADY OPTIMAL', originalChars: 0, compressedChars: 16, ratio: 1, ccrEntries: [], dynamicFields: [] }
  }

  const originalChars = input.length
  const { text: stripped, fields: dynamicFields } = extractDynamic(input)
  const segType = classify(stripped)

  let compressed
  switch (segType) {
    case 'JSON': compressed = compressJson(stripped, queryHint); break
    case 'CODE': compressed = compressCode(stripped);             break
    default:     compressed = compressText(stripped);             break
  }

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

  const ccrEntries = []
  const compressedRatio = compressed.length / Math.max(stripped.length, 1)

  if (compressedRatio < ccrThreshold) {
    const id = storeOriginal(input)
    const summary = compressed.slice(0, 80).replace(/\n/g, ' ') + '…'
    ccrEntries.push({ id, type: segType, summary, originalSize: originalChars })
    compressed = `[CCR:${segType}:${id}] ${summary}`
  }

  const parts = [compressed]

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

// ── CLI Entry ──────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`
compress-context.mjs — Headroom Context Optimizer

Usage:
  node compress-context.mjs <file>          Compress a file
  cat file.md | node compress-context.mjs   Compress from stdin
  node compress-context.mjs --retrieve <id> Retrieve original by CCR id

Options:
  --threshold <0-1>   CCR trigger threshold (default: 0.4)
  --hint <string>     Query context hint for JSON field scoring
  --stats             Print compression stats to stderr
  --help              Show this help
`.trim() + '\n')
}

async function runCli() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  // Parse flags
  const threshold = parseFloat(args[args.indexOf('--threshold') + 1]) || 0.4
  const hintIdx = args.indexOf('--hint')
  const queryHint = hintIdx !== -1 ? args[hintIdx + 1] : ''
  const showStats = args.includes('--stats')

  // Retrieve mode
  const retrieveIdx = args.indexOf('--retrieve')
  if (retrieveIdx !== -1) {
    const id = args[retrieveIdx + 1]
    const original = retrieveOriginal(id)
    if (original) {
      process.stdout.write(original)
    } else {
      process.stderr.write(`CCR id "${id}" not found in current session store.\n`)
      process.exit(1)
    }
    return
  }

  // Read input: file arg or stdin
  let input = ''
  const fileArg = args.find(a => !a.startsWith('--') && a !== queryHint && a !== String(threshold))

  if (fileArg) {
    try {
      input = readFileSync(fileArg, 'utf8')
    } catch (e) {
      process.stderr.write(`Error reading file: ${e.message}\n`)
      process.exit(1)
    }
  } else {
    // Read from stdin
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    input = Buffer.concat(chunks).toString('utf8')
  }

  if (!input.trim()) {
    process.stderr.write('No input provided. Use --help for usage.\n')
    process.exit(1)
  }

  const result = compressContext(input, { ccrThreshold: threshold, queryHint })

  process.stdout.write(result.output + '\n')

  if (showStats) {
    process.stderr.write([
      `\n[compress-context stats]`,
      `  Type:        ${result.ccrEntries[0]?.type ?? 'TEXT'}`,
      `  Original:    ${result.originalChars} chars`,
      `  Compressed:  ${result.compressedChars} chars`,
      `  Ratio:       ${Math.round((1 - result.ratio) * 100)}% reduction`,
      `  Dynamic:     ${result.dynamicFields.length} fields extracted`,
      `  CCR entries: ${result.ccrEntries.length}`,
    ].join('\n') + '\n')
  }
}

// Only run CLI when executed directly (not imported as module)
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  runCli().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1) })
}
