#!/usr/bin/env node
/**
 * tdd-cycle.mjs — agenthub TDD Workflow Runner
 *
 * Guides a development task through the mandatory TDD cycle:
 *   Plan → Write failing test → Develop → Verify → Debug/fix loop → Done
 *
 * Usage:
 *   node <agenthub>/scripts/tdd-cycle.mjs
 *   node <agenthub>/scripts/tdd-cycle.mjs --test-cmd "pytest tests/"
 *   node <agenthub>/scripts/tdd-cycle.mjs --test-cmd "npm test"
 */

import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── CLI helpers ──────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise(res => rl.question(`  ${question}: `, a => res(a.trim())))
}

function askYN(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]'
  return new Promise(res => {
    rl.question(`  ${question} ${hint} `, a => {
      const v = a.trim().toLowerCase()
      res(v === '' ? defaultYes : v === 'y')
    })
  })
}

function log(msg)    { process.stdout.write(msg + '\n') }
function header(msg) { log(`\n\x1b[1m${msg}\x1b[0m`) }
function ok(msg)     { log(`\x1b[32m  ✓ ${msg}\x1b[0m`) }
function fail(msg)   { log(`\x1b[31m  ✗ ${msg}\x1b[0m`) }
function info(msg)   { log(`\x1b[36m  → ${msg}\x1b[0m`) }
function warn(msg)   { log(`\x1b[33m  ⚠ ${msg}\x1b[0m`) }
function rule()      { log('\x1b[2m' + '─'.repeat(60) + '\x1b[0m') }

// ── Test runner ──────────────────────────────────────────────────────────────

function runTests(cmd) {
  try {
    const output = execSync(cmd, { stdio: 'pipe', encoding: 'utf8' })
    return { passed: true, output }
  } catch (e) {
    return { passed: false, output: e.stdout + e.stderr }
  }
}

// ── Cycle log ────────────────────────────────────────────────────────────────

function appendCycleLog(projectPath, entry) {
  const logPath = join(projectPath, '.claude', 'tdd-cycle.log')
  const line = `[${new Date().toISOString()}] ${entry}\n`
  try { appendFileSync(logPath, line, 'utf8') } catch {}
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function stepPlan() {
  header('Step 1 — Plan')
  rule()
  info('Describe the task before writing any code.')
  const task = await ask('What are you building or fixing?')
  const units = await ask('Break it into units (comma-separated, e.g. "parser, validator, handler")')
  log('')
  ok(`Task: ${task}`)
  ok(`Units: ${units}`)
  return { task, units: units.split(',').map(u => u.trim()).filter(Boolean) }
}

async function stepWriteFailingTest(testCmd) {
  header('Step 2 — Write failing test(s)')
  rule()
  info('Dispatch Test Agent to write failing tests NOW — before any implementation.')
  info('Tests must define the expected behaviour, not the implementation.')
  log('')
  log('  Checklist for Test Agent:')
  log('  • One test file per unit')
  log('  • Assertions are specific — no "assert result is not None"')
  log('  • Tests must FAIL before you hand off to Development Agent')
  log('')

  const written = await askYN('Have the failing tests been written?', false)
  if (!written) {
    warn('Tests must exist before development starts. Write them first.')
    return false
  }

  if (!testCmd) {
    testCmd = await ask('Test command to run (e.g. "pytest tests/" or "npm test")')
  }

  log('')
  info(`Running: ${testCmd}`)
  const result = runTests(testCmd)

  if (result.passed) {
    warn('Tests PASSED — they should be failing at this point.')
    warn('Either the tests are not asserting correctly, or the feature already exists.')
    log('\n' + result.output)
    const proceed = await askYN('Proceed anyway?', false)
    if (!proceed) return false
  } else {
    ok('Tests FAIL as expected — ready for development.')
    log('\x1b[2m' + result.output.slice(0, 800) + '\x1b[0m')
  }

  return testCmd
}

async function stepDevelop() {
  header('Step 3 — Develop')
  rule()
  info('Dispatch Development Agent to implement until the tests pass.')
  info('Development Agent must NOT modify test files.')
  log('')
  const done = await askYN('Has Development Agent finished implementation?', false)
  return done
}

async function stepVerify(testCmd) {
  header('Step 4 — Verify')
  rule()
  info(`Running: ${testCmd}`)
  const result = runTests(testCmd)

  if (result.passed) {
    ok('All tests PASS.')
    log('\x1b[2m' + result.output.slice(0, 800) + '\x1b[0m')
    return true
  } else {
    fail('Tests still FAILING.')
    log('\x1b[2m' + result.output.slice(0, 800) + '\x1b[0m')
    return false
  }
}

async function stepDebug(iteration) {
  header(`Step 5 — Debug / Fix (iteration ${iteration})`)
  rule()
  warn('Tests are still failing. Dispatch Debug Agent to find root cause.')
  log('')
  log('  Debug Agent must:')
  log('  • Read the failing test output above')
  log('  • Identify root cause (not surface symptom)')
  log('  • Propose a specific fix to Development Agent')
  log('  • NOT modify tests')
  log('')
  const fixed = await askYN('Has Debug Agent identified root cause and Development Agent applied the fix?', false)
  return fixed
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const cmdFlag = args.indexOf('--test-cmd')
  let testCmd   = cmdFlag !== -1 ? args[cmdFlag + 1] : null
  const projectPath = resolve('.')

  log('\n\x1b[1magenthub — TDD Cycle\x1b[0m')
  log('Plan → Failing test → Develop → Verify → Debug loop')
  rule()

  // Step 1: Plan
  const { task, units } = await stepPlan()
  appendCycleLog(projectPath, `PLAN: ${task} | units: ${units.join(', ')}`)

  // Step 2: Write failing tests
  const resolvedTestCmd = await stepWriteFailingTest(testCmd)
  if (!resolvedTestCmd) {
    warn('Cycle aborted — write failing tests first.')
    rl.close()
    process.exit(1)
  }
  testCmd = resolvedTestCmd
  appendCycleLog(projectPath, `TESTS_FAILING: cmd=${testCmd}`)

  // Step 3: Develop
  const devDone = await stepDevelop()
  if (!devDone) {
    warn('Cycle paused — resume once development is complete.')
    rl.close()
    process.exit(0)
  }
  appendCycleLog(projectPath, `DEVELOPED`)

  // Step 4+5: Verify → Debug loop
  let iteration  = 0
  let maxLoops   = 3
  let allPassing = false

  while (!allPassing && iteration <= maxLoops) {
    allPassing = await stepVerify(testCmd)

    if (allPassing) break

    if (iteration === maxLoops) {
      fail(`Still failing after ${maxLoops} debug iterations.`)
      warn('Stop. Re-examine the approach — do not keep patching.')
      appendCycleLog(projectPath, `STALLED after ${maxLoops} iterations`)
      rl.close()
      process.exit(1)
    }

    const debugDone = await stepDebug(++iteration)
    if (!debugDone) {
      warn('Cycle paused — resume once fix is applied.')
      rl.close()
      process.exit(0)
    }
    appendCycleLog(projectPath, `DEBUG_FIX iteration=${iteration}`)
  }

  // Done
  header('Done')
  rule()
  ok(`All tests pass for: ${task}`)
  info('Present output to user for approval before merging.')
  appendCycleLog(projectPath, `PASS: ${task}`)

  rl.close()
}

main().catch(e => {
  process.stderr.write(e.message + '\n')
  rl.close()
  process.exit(1)
})
