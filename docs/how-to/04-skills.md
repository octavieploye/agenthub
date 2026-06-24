# Skills

Skills are saved prompt templates you can send to an agent instantly.

## Where Skills Live

AgentHub scans for `.md` skill files in:

1. Your repo's `.claude/skills/` directory
2. The global `~/.claude/skills/` directory

The file name becomes the skill name; the file content becomes the prompt.

## Running a Skill

1. Select an agent in the main view
2. Open the **Skills** dropdown in SABar (lightning icon)
3. Click a skill — AgentHub sends its content to the active agent

## Creating a Skill

Create a `.md` file in `.claude/skills/` in your repo. It appears in the dropdown immediately (no restart needed). If it doesn't show, click the refresh icon in the skills dropdown.
