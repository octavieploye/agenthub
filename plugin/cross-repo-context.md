# Cross-Repo Skill Resolution

You are working in a repo that is NOT the agenthub repo. All skills, team orchestrators,
workflows, team configs, and agent role definitions live in the agenthub repo.

## Where to find things

The agenthub root path is available as the `AGENTHUB_HOME` environment variable.

| What | Path (relative to AGENTHUB_HOME) |
|---|---|
| Skills (SKILL.md) | `plugin/skills/<skill-name>/SKILL.md` or `.claude/skills/<skill-name>/SKILL.md` |
| Commands (agent roles) | `plugin/commands/<agent-name>.md` or `.claude/commands/<agent-name>.md` |
| Team configs | `.claude/teams/<team-name>/config.json` |
| Workflow manifests | `.claude/workflow-team-library/<workflow-name>/manifest.md` or `plugin/workflows/<workflow-name>/manifest.md` |
| Skills index | `plugin/skills/index.json` |
| Display registry | `plugin/skills/display-registry.json` |

## Resolution rules

1. When invoking a skill or team orchestrator, read its SKILL.md from agenthub using the paths above.
2. When spawning team members, their role definitions are in agenthub's commands directory.
3. When reading team configs or workflow manifests, use agenthub paths, not the current repo's CWD.
4. Code changes, output files, and git operations still target the CURRENT repo (your CWD) — only skill/workflow definitions come from agenthub.
5. If a skill or team config is not found at the agenthub path, do NOT fall back to inventing one — report the missing skill.
