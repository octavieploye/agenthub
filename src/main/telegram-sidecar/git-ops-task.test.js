'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildGitOpsTask } = require('./git-ops-task')

test('builds a provider-neutral local commit task', () => {
  const task = buildGitOpsTask('/tmp/example repo', false)

  assert.match(task, /Act as the git-ops agent/)
  assert.match(task, /\$AGENTHUB_HOME\/plugin\/commands\/git-commit\.md/)
  assert.match(task, /target repository at \/tmp\/example repo/)
  assert.match(task, /run `git status` and `git diff`/i)
  assert.match(task, /respect `\.gitignore`/i)
  assert.match(task, /derive the commit message from what actually changed/i)
  assert.match(task, /local commit only/)
  assert.match(task, /do not push/i)
  assert.doesNotMatch(task, /Run \/git-commit/)
})

test('builds an explicit commit-and-push task', () => {
  const task = buildGitOpsTask('/tmp/example', true)

  assert.match(task, /commit and push to origin/)
  assert.match(task, /human explicitly requested the push/)
  assert.match(task, /run `git status` and `git diff`/i)
  assert.doesNotMatch(task, /Run \/git-commit/)
})
