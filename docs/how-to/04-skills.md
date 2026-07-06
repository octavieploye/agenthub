# Skills & Workflows

Skills are saved prompt templates, workflows, and team orchestrators you can browse and send to an agent.

## Where Skills Live

AgentHub discovers items from four places in your repo's `.claude/` directory:

1. **Skills** — `.claude/skills/` (folders with `SKILL.md` entry points)
2. **Teams** — `.claude/teams/` (folders with `config.json`)
3. **Workflows** — `.claude/workflow-team-library/` (folders with `manifest.md`)
4. **Commands** — `.claude/commands/` (user-invocable `.md` files only; agent role definitions are filtered out)

## Skills Dropdown

Open the skills dropdown with the **book icon** in the top bar, or press **Cmd+L**.

### Browsing by Category

Skills are grouped into collapsible sections:

- **Code Quality** — code review, test integrity, AI instruction optimization
- **AI Configuration** — audit, fix, pre-build checks, post-sprint review
- **Market Intelligence** — market simulation phases, modeling, quick scans
- **Competitor Analysis** — competitor teardowns, business/market/dynamics analysis
- **Content & Voice** — voice profile, source-to-strategy, credibility checks
- **Workflows** — multi-step orchestrated workflows
- **Teams** — team orchestrators (business, marketing, brainstorm, etc.)
- **Utilities** — Telegram notifications, git commit

Click a section header to expand or collapse it. The first section opens by default.

### Searching

Type in the search bar to filter across all categories. Matching sections auto-expand. Clear the search to return to your previous view.

### Seeing What a Skill Does

Hover over any skill row to see its full description in a tooltip.

### Running a Skill

1. Select an agent in the main view
2. Open the skills dropdown (Cmd+L or book icon)
3. Find the skill by browsing categories or searching
4. Click it — AgentHub sends the slash command to the active agent

## Creating a New Skill

1. Create a folder in `.claude/skills/` with a `SKILL.md` file inside
2. Add the skill to `.claude/skills/display-registry.json` with a human-friendly display name and category
3. Click **Refresh** in the dropdown footer to pick it up

### Display Registry

The file `.claude/skills/display-registry.json` maps skill IDs to user-friendly names and categories. When you create, rename, or remove any skill, command, workflow, or team, update this file so the dropdown shows the right label.

Format:
```json
"skill-id": { "displayName": "Human Readable Name", "category": "category-key" }
```

Category keys: `code-quality`, `ai-config`, `market-intel`, `competitor-analysis`, `content-voice`, `workflows`, `teams`, `utilities`.
