#!/usr/bin/env node
/**
 * init-project.mjs — agenthub Project Initializer
 *
 * Scaffolds .claude/ config for a new or existing project.
 * - Checks if .claude/CLAUDE.md and .claude/agents.md already exist
 * - If missing: copies from template + offers interactive placeholder fill-in
 * - If present: offers to keep as-is or overwrite
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
const TEMPLATE_DIR = join(AGENTHUB_DIR, 'templates', 'new-project', '.claude')
const isDryRun     = process.argv.includes('--dry-run')

// ── CLI helpers ────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question, defaultVal = '') {
  const hint = defaultVal ? ` (${defaultVal})` : ''
  return new Promise(resolve => {
    rl.question(`  ${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultVal)
    })
  })
}

function askYN(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]'
  return new Promise(resolve => {
    rl.question(`  ${question} ${hint} `, answer => {
      const a = answer.trim().toLowerCase()
      resolve(a === '' ? defaultYes : a === 'y')
    })
  })
}

function log(msg)  { process.stdout.write(msg + '\n') }
function dim(msg)  { log(`\x1b[2m${msg}\x1b[0m`) }
function ok(msg)   { log(`\x1b[32m  ✓ ${msg}\x1b[0m`) }
function skip(msg) { log(`\x1b[33m  - ${msg}\x1b[0m`) }
function info(msg) { log(`\x1b[36m  → ${msg}\x1b[0m`) }

// ── Placeholder replacement ────────────────────────────────────────────────

function fillPlaceholders(content, values) {
  let out = content
  for (const [key, val] of Object.entries(values)) {
    if (val) out = out.replaceAll(key, val)
  }
  return out
}

// ── Interactive Q&A ────────────────────────────────────────────────────────

async function askProjectDetails() {
  log('\n\x1b[1mProject details\x1b[0m — press Enter to skip optional fields\n')

  const name        = await ask('Project name (required)')
  const description = await ask('One-line description (required)')
  const backend     = await ask('Backend stack   [optional]', 'e.g. Node.js / Python / Go')
  const frontend    = await ask('Frontend stack  [optional]', 'e.g. React / Angular / None')
  const database    = await ask('Database        [optional]', 'e.g. PostgreSQL / SQLite')
  const infra       = await ask('Infrastructure  [optional]', 'e.g. Docker / Vercel / None')
  const contextFile = await ask('Main context file path [optional]', 'docs/context.md')

  return { name, description, backend, frontend, database, infra, contextFile }
}

function buildReplacements({ name, description, backend, frontend, database, infra, contextFile }) {
  return {
    '[PROJECT NAME]': name,
    '[one-line description of what this project builds]': description,
    '[e.g. Node.js / Python / Java / Go]': backend,
    '[e.g. React / Angular / None]': frontend,
    '[e.g. PostgreSQL / SQLite / MongoDB]': database,
    '[e.g. Docker / K8s / Vercel / None]': infra,
    '[path/to/context.md]': contextFile,
    '[main context file]': contextFile,
  }
}

// ── File handler ───────────────────────────────────────────────────────────

async function handleFile(filename, projectClaudeDir, replacements) {
  const dst      = join(projectClaudeDir, filename)
  const src      = join(TEMPLATE_DIR, filename)
  const exists   = existsSync(dst)
  const label    = `.claude/${filename}`

  log(`\n\x1b[1m${label}\x1b[0m`)

  if (!existsSync(src)) {
    log(`  \x1b[31m✗ Template not found: ${src}\x1b[0m`)
    return false
  }

  if (exists) {
    info('File already exists')
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

// ── Main ───────────────────────────────────────────────────────────────────

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
  1. Checks if .claude/CLAUDE.md exists in the target project
  2. Checks if .claude/agents.md exists in the target project
  3. For missing files: copies from agenthub template + fills placeholders interactively
  4. For existing files: asks whether to keep or overwrite
    `.trim())
    rl.close()
    return
  }

  const projectPath      = resolve(args[0] ?? '.')
  const projectClaudeDir = join(projectPath, '.claude')

  log(`\n\x1b[1magenthub — init project\x1b[0m`)
  log(`Target: ${projectPath}`)
  if (isDryRun) log('\x1b[33mDRY RUN — no files will be written\x1b[0m')

  // Check which files are missing to decide if we need Q&A
  const claudeMdMissing  = !existsSync(join(projectClaudeDir, 'CLAUDE.md'))
  const agentsMdMissing  = !existsSync(join(projectClaudeDir, 'agents.md'))
  const anyMissing       = claudeMdMissing || agentsMdMissing

  // Only ask for project details if at least one file will be created
  let replacements = {}
  if (anyMissing && !isDryRun) {
    const wantFill = await askYN('\nFill in project details interactively?', true)
    if (wantFill) {
      const details = await askProjectDetails()
      replacements  = buildReplacements(details)
    } else {
      info('Skipping Q&A — placeholders will remain in the files. Fill them in manually.')
    }
  }

  // Handle each file
  const wroteClaudeMd = await handleFile('CLAUDE.md',  projectClaudeDir, replacements)
  const wroteAgentsMd = await handleFile('agents.md',  projectClaudeDir, replacements)

  // Summary
  log('\n\x1b[1mDone\x1b[0m')
  if (!wroteClaudeMd && !wroteAgentsMd) {
    log('  No files changed.')
  } else {
    if (wroteClaudeMd || wroteAgentsMd) {
      info('Next steps:')
      if (wroteClaudeMd) log('  • Review .claude/CLAUDE.md — fill any remaining [PLACEHOLDERS]')
      if (wroteAgentsMd) log('  • Review .claude/agents.md — customise agent roster for this project\'s stack')
      log('  • Run: node scripts/sync-global-claude.mjs   (if not already synced)')
      log('  • Open a Claude Code session in the project directory\n')
    }
  }

  rl.close()
}

main().catch(e => {
  process.stderr.write(e.message + '\n')
  rl.close()
  process.exit(1)
})
