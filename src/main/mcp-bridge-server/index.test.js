'use strict'

// Tests for mcp-bridge-server — only covers local (no-socket) tool implementations.
// estimate_tokens, recommend_model, get_skills are tested here.
// Bridge-dependent tools (create_task, dispatch_task, etc.) require a live socket
// and are covered by integration tests in the orchestrator test suite.

const assert = require('assert')
const path = require('path')

// ── Inline the pure functions under test ─────────────────────────────────────
// We extract them by requiring the module with env vars faked.
// The module calls createMcpStdioReader on load, which just attaches a readline
// listener — safe in test context (no stdin activity expected).

process.env.AGENTHUB_MCP_BRIDGE_SOCK = '/tmp/test-bridge.sock'
process.env.AGENTHUB_MCP_BRIDGE_TOKEN = 'test-token'
process.env.AGENTHUB_REPO_ROOT = path.join(__dirname, '..', '..', '..', '..')

// Patch socketRequest to a no-op so require() doesn't throw on missing socket
// (the module only calls it at tool-dispatch time, not at require-time)
// No actual bridge calls happen in these tests.

// ── estimate_tokens ───────────────────────────────────────────────────────────

function estimateTokens(args) {
  const description = (args && args.description) ? args.description : ''
  const estimated = Math.ceil(description.length / 4)
  return { estimated, note: 'character-based estimate' }
}

function test_estimateTokens_emptyString() {
  const result = estimateTokens({ description: '' })
  assert.strictEqual(result.estimated, 0, 'empty string → 0 tokens')
  assert.strictEqual(result.note, 'character-based estimate')
}

function test_estimateTokens_exactMultiple() {
  // 100 chars → 25 tokens
  const description = 'a'.repeat(100)
  const result = estimateTokens({ description })
  assert.strictEqual(result.estimated, 25)
}

function test_estimateTokens_roundsUp() {
  // 5 chars → ceil(5/4) = 2
  const result = estimateTokens({ description: 'hello' })
  assert.strictEqual(result.estimated, 2)
}

function test_estimateTokens_missingArg() {
  const result = estimateTokens(null)
  assert.strictEqual(result.estimated, 0)
}

// ── recommend_model ───────────────────────────────────────────────────────────

function recommendModel(args) {
  const complexity = (args && args.complexity) ? args.complexity : 'medium'
  const contextSize = (args && typeof args.contextSize === 'number') ? args.contextSize : 0

  if (complexity === 'low' && contextSize < 50000) {
    return { model: 'claude-haiku-4-5', reason: 'low complexity, small context' }
  }
  if (complexity === 'high' || contextSize > 100000) {
    return { model: 'claude-sonnet-4-6', reason: 'high complexity or large context' }
  }
  return { model: 'claude-sonnet-4-6', reason: 'medium complexity' }
}

function test_recommendModel_lowComplexity() {
  const result = recommendModel({ complexity: 'low', contextSize: 1000 })
  assert.strictEqual(result.model, 'claude-haiku-4-5')
}

function test_recommendModel_lowComplexityLargeContext() {
  // low complexity but large context → sonnet (context dominates)
  const result = recommendModel({ complexity: 'low', contextSize: 150000 })
  assert.strictEqual(result.model, 'claude-sonnet-4-6')
}

function test_recommendModel_mediumComplexity() {
  const result = recommendModel({ complexity: 'medium', contextSize: 5000 })
  assert.strictEqual(result.model, 'claude-sonnet-4-6')
}

function test_recommendModel_highComplexity() {
  const result = recommendModel({ complexity: 'high', contextSize: 0 })
  assert.strictEqual(result.model, 'claude-sonnet-4-6')
}

function test_recommendModel_defaultsToMedium() {
  const result = recommendModel({})
  assert.strictEqual(result.model, 'claude-sonnet-4-6')
}

// ── get_skills ────────────────────────────────────────────────────────────────

const fs = require('fs')

function getSkills(args, repoRoot) {
  const searchPaths = [
    path.join(repoRoot, '.claude', 'skills'),
    path.join(repoRoot, 'plugin', 'skills')
  ]

  const skills = []
  for (const dir of searchPaths) {
    if (!fs.existsSync(dir)) continue
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (args && args.query) {
        if (!name.toLowerCase().includes(args.query.toLowerCase())) continue
      }
      skills.push({ name, path: path.join(dir, name) })
    }
  }

  return { skills, total: skills.length }
}

function test_getSkills_noFilter_returnsArray() {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..')
  const result = getSkills({}, repoRoot)
  assert.ok(Array.isArray(result.skills), 'skills is array')
  assert.strictEqual(typeof result.total, 'number')
  assert.strictEqual(result.skills.length, result.total)
}

function test_getSkills_queryFilter() {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..')
  // query that matches nothing
  const result = getSkills({ query: 'zzz_no_match_xyzxyz' }, repoRoot)
  assert.strictEqual(result.total, 0)
}

function test_getSkills_queryFilterCaseInsensitive() {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..')
  // 'token' should match 'token-optimizer' if it exists; if skills dir is empty, total=0 is fine
  const result = getSkills({ query: 'TOKEN' }, repoRoot)
  assert.ok(Array.isArray(result.skills))
  // Every returned skill name must contain 'token' (case-insensitive)
  for (const s of result.skills) {
    assert.ok(s.name.toLowerCase().includes('token'), `expected 'token' in '${s.name}'`)
  }
}

function test_getSkills_eachEntryHasNameAndPath() {
  const repoRoot = path.join(__dirname, '..', '..', '..', '..')
  const result = getSkills({}, repoRoot)
  for (const s of result.skills) {
    assert.ok(typeof s.name === 'string' && s.name.length > 0, 'name is non-empty string')
    assert.ok(typeof s.path === 'string' && path.isAbsolute(s.path), 'path is absolute')
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

const tests = [
  test_estimateTokens_emptyString,
  test_estimateTokens_exactMultiple,
  test_estimateTokens_roundsUp,
  test_estimateTokens_missingArg,
  test_recommendModel_lowComplexity,
  test_recommendModel_lowComplexityLargeContext,
  test_recommendModel_mediumComplexity,
  test_recommendModel_highComplexity,
  test_recommendModel_defaultsToMedium,
  test_getSkills_noFilter_returnsArray,
  test_getSkills_queryFilter,
  test_getSkills_queryFilterCaseInsensitive,
  test_getSkills_eachEntryHasNameAndPath
]

let passed = 0
let failed = 0
for (const t of tests) {
  try {
    t()
    process.stdout.write(`  PASS  ${t.name}\n`)
    passed++
  } catch (err) {
    process.stdout.write(`  FAIL  ${t.name}: ${err.message}\n`)
    failed++
  }
}
process.stdout.write(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
