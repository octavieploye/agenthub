#!/usr/bin/env node
/**
 * init-project.mjs — agenthub Project Initializer
 *
 * 1. Checks for README.md and DEVELOPMENT-PLAN.md in the target project.
 *    - If missing: copies templates (with placeholders) so the user can fill them in.
 *    - If present: parses them to extract project details automatically.
 * 2. Uses extracted (or interactively asked) details to fill placeholders in:
 *    - .claude/CLAUDE.md
 *    - .claude/agents.md
 *
 * Usage:
 *   node scripts/init-project.mjs <project-path>   target a specific project
 *   node scripts/init-project.mjs .                use current directory
 *   node scripts/init-project.mjs --dry-run        preview only, no writes
 *   node scripts/init-project.mjs --help
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createInterface } from 'node:readline'

const SCRIPT_DIR   = dirname(new URL(import.meta.url).pathname)
const AGENTHUB_DIR = join(SCRIPT_DIR, '..')
const TEMPLATE_DIR = join(AGENTHUB_DIR, 'templates', 'new-project')
const isDryRun     = process.argv.includes('--dry-run')

// ── CLI helpers ─────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question, defaultVal = '') {
  const hint = defaultVal ? ` (${defaultVal})` : ''
  return new Promise(res => {
    rl.question(`  ${question}${hint}: `, answer => {
      res(answer.trim() || defaultVal)
    })
  })
}

function askYN(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]'
  return new Promise(res => {
    rl.question(`  ${question} ${hint} `, answer => {
      const a = answer.trim().toLowerCase()
      res(a === '' ? defaultYes : a === 'y')
    })
  })
}

function log(msg)  { process.stdout.write(msg + '\n') }
function dim(msg)  { log(`\x1b[2m${msg}\x1b[0m`) }
function ok(msg)   { log(`\x1b[32m  ✓ ${msg}\x1b[0m`) }
function skip(msg) { log(`\x1b[33m  - ${msg}\x1b[0m`) }
function info(msg) { log(`\x1b[36m  → ${msg}\x1b[0m`) }
function warn(msg) { log(`\x1b[33m  ⚠ ${msg}\x1b[0m`) }

// ── Placeholder replacement ──────────────────────────────────────────────────

function fillPlaceholders(content, values) {
  let out = content
  for (const [key, val] of Object.entries(values)) {
    if (val) out = out.replaceAll(key, val)
  }
  return out
}

// ── README parser ────────────────────────────────────────────────────────────
//
// Extracts:
//   name        — first H1 line
//   description — first non-empty line after the H1

function parseReadme(content) {
  const lines = content.split('\n')
  let name = ''
  let description = ''
  let foundH1 = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!foundH1 && trimmed.startsWith('# ')) {
      name = trimmed.replace(/^#\s+/, '')
      foundH1 = true
      continue
    }
    if (foundH1 && trimmed && !trimmed.startsWith('#')) {
      description = trimmed
      break
    }
  }

  return { name, description }
}

// ── DEVELOPMENT-PLAN parser ──────────────────────────────────────────────────
//
// Extracts stack values from a markdown table under a "Stack" heading:
//   | Layer    | Technology            |
//   | Backend  | Python 3.12 + FastAPI |
//   | Frontend | Electron + React      |
//   | Database | PostgreSQL            |
//   | Infra    | Docker Compose        |
//
// Only reads the stack table — ignores other tables (service matrices, schemas).
// Also extracts key files from a code block in the project structure section.

function parseDevelopmentPlan(content) {
  const stack = { backend: '', frontend: '', database: '', infra: '' }
  const lines = content.split('\n')
  let inStackSection = false
  let inCodeBlock = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) { inCodeBlock = !inCodeBlock }
    if (!inCodeBlock && trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+\s*/, '').toLowerCase()
      inStackSection = heading.includes('stack')
    }
    if (inStackSection && !inCodeBlock) {
      const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
      if (tableMatch) {
        const label = tableMatch[1].trim().toLowerCase()
        const value = tableMatch[2].trim()
        if (/^[-:]+$/.test(value) || label === 'layer' || label === 'technology') continue
        if (label.includes('backend') || label.includes('api'))  stack.backend  = stack.backend  || value
        if (label.includes('frontend') || label.includes('ui'))  stack.frontend = stack.frontend || value
        if (label.includes('database') || label.includes('db'))  stack.database = stack.database || value
        if (label.includes('infra') || label.includes('deploy')) stack.infra    = stack.infra    || value
      }
    }
  }

  return { stack }
}

// ── Project filesystem scanner ───────────────────────────────────────────────
//
// Checks known locations in the target project and returns only those that exist.

function scanKeyFiles(projectPath) {
  const candidates = [
    { rel: 'README.md',            desc: 'project overview and entry point' },
    { rel: 'DEVELOPMENT-PLAN.md',  desc: 'full architecture, build phases, and constraints' },
    { rel: 'docs/',                desc: 'documentation directory' },
    { rel: 'docs/context.md',      desc: 'project context and decisions' },
    { rel: 'sprints/',             desc: 'per-role sprint plans' },
    { rel: 'docs/sprints/',        desc: 'per-role sprint plans' },
    { rel: 'src/',                 desc: 'source code' },
    { rel: 'backend/',             desc: 'backend services' },
    { rel: 'frontend/',            desc: 'frontend application' },
    { rel: 'brain_core/',          desc: 'core engine / rule system' },
  ]

  return candidates
    .filter(c => existsSync(join(projectPath, c.rel)))
    .map(c => ({ path: c.rel, desc: c.desc }))
    .slice(0, 6)
}

// ── Constraints parser ───────────────────────────────────────────────────────
//
// Finds the "Key constraints" section in DEVELOPMENT-PLAN.md and splits
// items into three buckets based on keyword matching.

function parseConstraints(content) {
  const security = []
  const never    = []
  const general  = []

  const lines = content.split('\n')
  let inConstraints = false

  const SECURITY_KEYWORDS = ['secret', 'credential', 'auth', 'token', 'encrypt',
                              'direct', 'access', 'permission', 'isolation', 'llm']
  const NEVER_KEYWORDS    = ['never', 'must not', 'cannot', 'no direct', 'no raw',
                              'no hardcoded', 'no ai self']

  for (const line of lines) {
    const trimmed = line.trim()

    // Enter constraints section
    if (trimmed.match(/^#+\s*key constraints/i)) {
      inConstraints = true
      continue
    }

    // Exit on next heading
    if (inConstraints && trimmed.startsWith('#')) break

    if (!inConstraints) continue

    // Extract numbered or bulleted items: "1. Foo" or "- Foo"
    const itemMatch = trimmed.match(/^(?:\d+\.|[-*])\s+(.+)/)
    if (!itemMatch) continue

    const text = itemMatch[1].trim()
    const lower = text.toLowerCase()

    const isNever    = NEVER_KEYWORDS.some(k => lower.includes(k))
    const isSecurity = SECURITY_KEYWORDS.some(k => lower.includes(k))

    if (isNever)         never.push(text)
    else if (isSecurity) security.push(text)
    else                 general.push(text)
  }

  return { security, never, general }
}

// ── Build replacements map ───────────────────────────────────────────────────

function buildReplacements({ name, description, backend, frontend, database, infra,
                              keyFiles, projectRules, securityRules, neverRules }) {
  const keyFilesBlock = keyFiles.length > 0
    ? keyFiles.map(f => `- \`${f.path}\` — ${f.desc}`).join('\n')
    : '- Add key file paths here'

  const projectRulesBlock = projectRules.length > 0
    ? projectRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific rules here'

  const securityRulesBlock = securityRules.length > 0
    ? securityRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific security rules here'

  const neverRulesBlock = neverRules.length > 0
    ? neverRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific never rules here'

  return {
    '[PROJECT_NAME]':         name        || '[PROJECT NAME]',
    '[PROJECT_DESCRIPTION]':  description || '[one-line description]',
    '[STACK_BACKEND]':        backend     || '[e.g. Node.js / Python / Go]',
    '[STACK_FRONTEND]':       frontend    || '[e.g. React / Angular / None]',
    '[STACK_DATABASE]':       database    || '[e.g. PostgreSQL / SQLite]',
    '[STACK_INFRA]':          infra       || '[e.g. Docker / Vercel / None]',
    '[KEY_FILES_BLOCK]':      keyFilesBlock,
    '[PROJECT_RULES_BLOCK]':  projectRulesBlock,
    '[SECURITY_RULES_BLOCK]': securityRulesBlock,
    '[NEVER_RULES_BLOCK]':    neverRulesBlock,
    '[main context file]':    keyFiles[0]?.path ?? 'README.md',
  }
}

// ── Interactive Q&A (fallback when no docs found) ────────────────────────────

async function askProjectDetails(prefill = {}) {
  log('\n\x1b[1mProject details\x1b[0m — press Enter to accept detected value or skip\n')
  const name        = await ask('Project name (required)',         prefill.name        ?? '')
  const description = await ask('One-line description (required)', prefill.description ?? '')
  const backend     = await ask('Backend stack   [optional]',      prefill.backend     ?? '')
  const frontend    = await ask('Frontend stack  [optional]',      prefill.frontend    ?? '')
  const database    = await ask('Database        [optional]',      prefill.database    ?? '')
  const infra       = await ask('Infrastructure  [optional]',      prefill.infra       ?? '')
  return {
    name, description, backend, frontend, database, infra,
    keyFiles:      prefill.keyFiles      ?? [],
    projectRules:  prefill.projectRules  ?? [],
    securityRules: prefill.securityRules ?? [],
    neverRules:    prefill.neverRules    ?? [],
  }
}

// ── Doc file handler (README / DEVELOPMENT-PLAN) ─────────────────────────────

async function handleDocFile(filename, projectPath, label) {
  const dst    = join(projectPath, filename)
  const src    = join(TEMPLATE_DIR, filename)
  const exists = existsSync(dst)

  if (exists) {
    ok(`${label} found — will parse for project details`)
    return { existed: true, content: readFileSync(dst, 'utf8') }
  }

  warn(`${label} not found`)

  if (!existsSync(src)) {
    warn(`  No template available at ${src} — skipping`)
    return { existed: false, content: null }
  }

  const create = await askYN(`  Create ${filename} from template?`, true)
  if (!create) {
    skip(`Skipped ${filename}`)
    return { existed: false, content: null }
  }

  if (isDryRun) {
    dim(`  [dry-run] Would write: ${dst}`)
    return { existed: false, content: null }
  }

  const content = readFileSync(src, 'utf8')
  writeFileSync(dst, content, 'utf8')
  ok(`Created ${filename} from template — fill in the placeholders before your first session`)
  return { existed: false, content: null }
}

// ── .claude file handler ──────────────────────────────────────────────────────

async function handleClaudeFile(filename, projectClaudeDir, replacements) {
  const dst    = join(projectClaudeDir, filename)
  const src    = join(TEMPLATE_DIR, '.claude', filename)
  const exists = existsSync(dst)
  const label  = `.claude/${filename}`

  log(`\n\x1b[1m${label}\x1b[0m`)

  if (!existsSync(src)) {
    log(`  \x1b[31m✗ Template not found: ${src}\x1b[0m`)
    return false
  }

  if (exists) {
    const currentContent = readFileSync(dst, 'utf8')
    const hasUnfilled = currentContent.includes('[PROJECT NAME]') ||
                        currentContent.includes('[PLACEHOLDERS]') ||
                        currentContent.includes('[one-line description')

    if (hasUnfilled && replacements && Object.keys(replacements).length > 0) {
      info('File exists but still has unfilled placeholders — filling in-place')
      if (isDryRun) {
        dim(`  [dry-run] Would fill placeholders in: ${dst}`)
        return false
      }
      const filled = fillPlaceholders(currentContent, replacements)
      writeFileSync(dst, filled, 'utf8')
      ok(`Filled placeholders in: ${label}`)
      return true
    }

    info('File already exists and looks complete')
    const keep = await askYN('Keep existing file?', true)
    if (keep) {
      skip(`Kept existing ${label}`)
      return false
    }
    info('Will overwrite with template')
  } else {
    info('File not found — will create from template')
  }

  let content = readFileSync(src, 'utf8')

  if (replacements && Object.keys(replacements).length > 0) {
    content = fillPlaceholders(content, replacements)
  }

  if (isDryRun) {
    dim(`  [dry-run] Would write: ${dst}`)
    return false
  }

  mkdirSync(projectClaudeDir, { recursive: true })
  writeFileSync(dst, content, 'utf8')
  ok(`Written: ${label}`)
  return true
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'))

  if (process.argv.includes('--help')) {
    log(`
init-project.mjs — agenthub Project Initializer

Usage:
  node scripts/init-project.mjs <project-path>
  node scripts/init-project.mjs .               current directory
  node scripts/init-project.mjs --dry-run       preview only

What it does:
  1. Checks for README.md and DEVELOPMENT-PLAN.md in the target project
     - If missing: creates them from templates (with placeholders)
     - If present: parses them to extract project name, description, stack, key files
  2. Uses extracted details to fill placeholders in .claude/CLAUDE.md and .claude/agents.md
     - If docs were missing or had no parseable info: falls back to interactive Q&A
    `.trim())
    rl.close()
    return
  }

  const projectPath      = resolve(args[0] ?? '.')
  const projectClaudeDir = join(projectPath, '.claude')

  log(`\n\x1b[1magenthub — init project\x1b[0m`)
  log(`Target: ${projectPath}`)
  if (isDryRun) log('\x1b[33mDRY RUN — no files will be written\x1b[0m')

  // ── Step 1: Handle README and DEVELOPMENT-PLAN ──────────────────────────────

  log('\n\x1b[1mStep 1 — Project docs\x1b[0m')

  const readme  = await handleDocFile('README.md',           projectPath, 'README.md')
  const devplan = await handleDocFile('DEVELOPMENT-PLAN.md', projectPath, 'DEVELOPMENT-PLAN.md')

  // ── Step 2: Extract details from existing docs ───────────────────────────────

  let extracted = {
    name: '', description: '',
    backend: '', frontend: '', database: '', infra: '',
    keyFiles: [],
    projectRules: [], securityRules: [], neverRules: []
  }

  if (readme.content) {
    const parsed = parseReadme(readme.content)
    extracted.name        = parsed.name
    extracted.description = parsed.description
    if (extracted.name)        info(`Detected project name: ${extracted.name}`)
    if (extracted.description) info(`Detected description:  ${extracted.description}`)
  }

  extracted.keyFiles = scanKeyFiles(projectPath)

  if (devplan.content) {
    const parsed = parseDevelopmentPlan(devplan.content)
    extracted.backend  = parsed.stack.backend
    extracted.frontend = parsed.stack.frontend
    extracted.database = parsed.stack.database
    extracted.infra    = parsed.stack.infra

    const constraints       = parseConstraints(devplan.content)
    extracted.projectRules  = constraints.general
    extracted.securityRules = constraints.security
    extracted.neverRules    = constraints.never

    if (extracted.backend)  info(`Detected backend:   ${extracted.backend}`)
    if (extracted.frontend) info(`Detected frontend:  ${extracted.frontend}`)
    if (extracted.database) info(`Detected database:  ${extracted.database}`)
    if (extracted.infra)    info(`Detected infra:     ${extracted.infra}`)
    if (extracted.projectRules.length)  info(`Detected ${extracted.projectRules.length} project rule(s)`)
    if (extracted.securityRules.length) info(`Detected ${extracted.securityRules.length} security rule(s)`)
    if (extracted.neverRules.length)    info(`Detected ${extracted.neverRules.length} never rule(s)`)
  }

  // ── Step 3: Decide how to fill .claude placeholders ──────────────────────────

  log('\n\x1b[1mStep 2 — .claude config\x1b[0m')

  const claudeMdMissing = !existsSync(join(projectClaudeDir, 'CLAUDE.md'))
  const agentsMdMissing = !existsSync(join(projectClaudeDir, 'agents.md'))
  const anyClaudeMissing = claudeMdMissing || agentsMdMissing

  let details = extracted
  const hasEnoughExtracted = extracted.name && extracted.description

  if (anyClaudeMissing && !isDryRun) {
    if (hasEnoughExtracted) {
      log('')
      info('Project details detected from docs — using them to fill placeholders automatically.')
      const confirm = await askYN('Proceed with detected values?', true)
      if (!confirm) {
        details = await askProjectDetails(extracted)
      }
    } else {
      warn('Could not extract enough project details from docs.')
      const wantFill = await askYN('Fill in project details interactively?', true)
      if (wantFill) {
        details = await askProjectDetails(extracted)
      } else {
        info('Skipping Q&A — placeholders will remain. Fill them in manually.')
      }
    }
  }

  const replacements = buildReplacements(details)

  // ── Step 4: Scaffold .claude files ───────────────────────────────────────────

  const wroteClaudeMd = await handleClaudeFile('CLAUDE.md',  projectClaudeDir, replacements)
  const wroteAgentsMd = await handleClaudeFile('agents.md',  projectClaudeDir, replacements)

  // ── Summary ───────────────────────────────────────────────────────────────────

  log('\n\x1b[1mDone\x1b[0m')
  const wroteAnything = wroteClaudeMd || wroteAgentsMd

  if (!wroteAnything && readme.existed && devplan.existed) {
    log('  No files changed.')
  } else {
    info('Next steps:')
    if (!readme.existed)   log('  • Fill in README.md placeholders')
    if (!devplan.existed)  log('  • Fill in DEVELOPMENT-PLAN.md placeholders')
    if (wroteClaudeMd)     log('  • Review .claude/CLAUDE.md — fill any remaining [PLACEHOLDERS]')
    if (wroteAgentsMd)     log('  • Review .claude/agents.md — customise agent roster for this project\'s stack')
    log('  • Run: node scripts/sync-global-claude.mjs   (if not already synced)')
    log('  • Open a Claude Code session in the project directory\n')
  }

  rl.close()
}

main().catch(e => {
  process.stderr.write(e.message + '\n')
  rl.close()
  process.exit(1)
})
