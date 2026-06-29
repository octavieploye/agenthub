# Skills

Skills are saved prompt templates you can send to an agent instantly.

## Where Skills Live

AgentHub scans for `.md` skill files in:

1. Your repo's `.claude/skills/` directory
2. The global `~/.claude/skills/` directory

The file name becomes the skill name; the file content becomes the prompt.

## Skills Index Panel

The Skills Index is a full search panel for browsing and dispatching skills.

- Open it with the **book icon** in the top bar, or press **⌘L**
- Type to filter skills by name, description, or category
- Click any skill to send it as `/skill-name` to the active agent's terminal
- Hover the **ⓘ** button on a skill row to see its full description

If no agent is active, the panel shows a warning — select an agent first.

## Running a Skill

1. Select an agent in the main view
2. Press **⌘L** (or click the book icon) to open the Skills Index
3. Search for the skill and click it — AgentHub sends the slash command to the active agent

## Creating a Skill

Create a `.md` file in `.claude/skills/` in your repo. It appears in the dropdown immediately (no restart needed). If it doesn't show, click the refresh icon in the skills dropdown.
