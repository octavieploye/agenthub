'use strict'

/**
 * Build a provider-neutral commit task for Claude, Codex, or Ollama agents.
 * Slash commands from an AgentHub plugin are namespaced in Claude and are not
 * understood by Codex, so agents read the shared command instructions directly.
 */
function buildGitOpsTask(repoPath, push) {
  const action = push
    ? 'Create the commit and push to origin; the human explicitly requested the push.'
    : 'Create a local commit only; do not push.'

  return [
    `Act as the git-ops agent for the target repository at ${repoPath}.`,
    'Before taking any Git action, read and follow $AGENTHUB_HOME/plugin/commands/git-commit.md.',
    'Do not invoke /git-commit as a shell or slash command; follow the file as provider-neutral instructions.',
    'First run `git status` and `git diff` to inspect the actual uncommitted changes, stage only the source/config files that belong to this change, respect `.gitignore`, and derive the commit message from what actually changed.',
    action,
  ].join(' ')
}

module.exports = { buildGitOpsTask }
