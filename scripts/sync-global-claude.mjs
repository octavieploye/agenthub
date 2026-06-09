#!/usr/bin/env node
/**
 * sync-global-claude.mjs — agenthub Global Config Sync
 *
 * Copies agenthub/global-claude/ → ~/.claude/
 * This makes the global rules and skills available in every Claude Code session.
 *
 * Usage:
 *   node scripts/sync-global-claude.mjs             # sync (with confirmation)
 *   node scripts/sync-global-claude.mjs --dry-run   # preview only, no writes
 *   node scripts/sync-global-claude.mjs --force     # sync without confirmation
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'

const SOURCE_DIR = join(dirname(new URL(import.meta.url).pathname), '..', 'global-claude')
const TARGET_DIR = join(homedir(), '.claude')

const isDryRun = process.argv.includes('--dry-run')
const isForce  = process.argv.includes('--force')

// ── File Walker ────────────────────────────────────────────────────────────

function walkDir(dir, base = dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel  = relative(base, full)
    if (statSync(full).isDirectory()) {
      entries.push(...walkDir(full, base))
    } else {
      entries.push(rel)
    }
  }
  return entries
}

// ── Diff Check ─────────────────────────────────────────────────────────────

function filesDiffer(srcPath, dstPath) {
  if (!existsSync(dstPath)) return true
  return readFileSync(srcPath, 'utf8') !== readFileSync(dstPath, 'utf8')
}

// ── Confirm Prompt ─────────────────────────────────────────────────────────

function confirm(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    process.stderr.write(`Source not found: ${SOURCE_DIR}\n`)
    process.exit(1)
  }

  const files = walkDir(SOURCE_DIR)

  // Compute what would change
  const toWrite   = []
  const unchanged = []

  for (const rel of files) {
    const src = join(SOURCE_DIR, rel)
    const dst = join(TARGET_DIR, rel)
    if (filesDiffer(src, dst)) {
      toWrite.push({ rel, src, dst })
    } else {
      unchanged.push(rel)
    }
  }

  // Report
  console.log(`\nagenthub → ~/.claude sync`)
  console.log(`Source:  ${SOURCE_DIR}`)
  console.log(`Target:  ${TARGET_DIR}`)
  console.log(`Mode:    ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}\n`)

  if (unchanged.length > 0) {
    console.log(`Unchanged (${unchanged.length}):`)
    for (const f of unchanged) console.log(`  = ${f}`)
  }

  if (toWrite.length === 0) {
    console.log('\nAll files already up to date.')
    return
  }

  console.log(`\nTo write (${toWrite.length}):`)
  for (const { rel, dst } of toWrite) {
    const exists = existsSync(dst)
    console.log(`  ${exists ? 'U' : 'A'} ${rel}  ${exists ? '(update)' : '(new)'}`)
  }

  if (isDryRun) {
    console.log('\nDry run complete — no files written.')
    return
  }

  if (!isForce) {
    const ok = await confirm(`\nWrite ${toWrite.length} file(s) to ~/.claude? [y/N] `)
    if (!ok) {
      console.log('Aborted.')
      return
    }
  }

  // Write files
  for (const { rel, src, dst } of toWrite) {
    const dstDir = dirname(dst)
    if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
    writeFileSync(dst, readFileSync(src))
    console.log(`  ✓ ${rel}`)
  }

  console.log(`\nSync complete. ${toWrite.length} file(s) written to ${TARGET_DIR}`)
  console.log('These rules and skills are now active in all Claude Code sessions on this machine.\n')
}

main().catch(e => { process.stderr.write(e.message + '\n'); process.exit(1) })
