# Skills

Skills are saved prompt templates you can send to an agent instantly.

## What is a Skill?

A skill is a `.md` file that contains a prompt or instruction set for a specific recurring task — e.g. "write a changelog entry", "review this code for security issues", "summarise today's agent activity".

## Where Skills Live

AgentHub scans for skill files in:

1. The selected repo's `.claude/skills/` directory (repo-level)
2. The global `~/.claude/skills/` directory (user-level)

File naming: `skill-name.md`. The file's content becomes the prompt.

## Running a Skill

1. Select an agent in the main view
2. Open the **Skills** dropdown in the SABar (the lightning icon)
3. Click a skill — AgentHub sends its content to the active agent as input

## Creating a Skill

Create a `.md` file in `.claude/skills/` in your repo:

```
# Changelog Entry

Write a CHANGELOG.md entry for the changes since the last git tag.
Format: ## [version] - YYYY-MM-DD followed by bullet points grouped by Added / Fixed / Changed.
```

The skill appears in the dropdown immediately (no restart needed).

## Skill Refresh

If you add a skill and it doesn't appear, click the refresh icon in the skills dropdown. AgentHub re-scans the skill directories.
