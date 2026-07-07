---
name: skill-creator
description: Use when creating a new skill, team, workflow, or command — or when reverse-engineering a task into a reusable artifact. Covers directory layout, required files, frontmatter, config.json, manifest.yaml, index registration, and discovery.
category: dev-skills
---

# Skill Creator

Create skills, teams, workflows, and commands that appear correctly in the skills panel and are discoverable by agents.

## When to Use

- User says "create a skill for X" or "make this reusable"
- You need to reverse-engineer a task into a repeatable workflow
- A new team or agent role needs to be set up
- An existing manual process should become an invocable skill

## Artifact Types

| Type | What it is | Discovery | Entry point |
|---|---|---|---|
| **Skill** | Single-agent capability | SkillsService → skills panel | `.claude/skills/{name}/SKILL.md` |
| **Team** | Multi-agent roster + orchestrator | SkillsService → skills panel | `.claude/teams/{name}/config.json` |
| **Workflow** | Multi-step methodology for a team | SkillsService → skills panel | `.claude/workflow-team-library/{name}/manifest.md` |
| **Command** | Agent role definition (invoked via `/command`) | Claude CLI slash commands | `.claude/commands/{name}.md` |

---

## Step 1 — Reverse-Engineer the Task

Before creating anything, answer these questions:

1. **What outcome does this produce?** (report, code change, decision, artifact)
2. **How many agents are needed?** 1 = skill, 2+ = team
3. **Is there a multi-step methodology?** Yes = workflow needed alongside the team
4. **Does a single agent need role instructions?** Yes = command file
5. **Does something similar already exist?** Check `index.json` and `index.md` first

## Step 2 — Research (if needed)

When creating a skill for an unfamiliar domain:

1. Use `WebSearch` on trusted sources (academic, official docs, established frameworks)
2. **No corporate blogs, no Reddit, no Medium** as sole sources — apply trustworthy-sources skill
3. **5-turn limit**: if you cannot find reliable patterns after 5 search rounds, inform the user before continuing
4. Extract: inputs → steps → outputs → constraints → failure modes

## Step 3 — Create the Artifact

Pick the right template below.

---

### 3A — Single Skill

**Directory:** `.claude/skills/{skill-name}/`

**Required files:**

```
.claude/skills/{skill-name}/
  SKILL.md          ← entry point (required)
  criteria.md       ← optional: evaluation criteria, checklists
  test-scenarios.md ← optional: behavioral test cases
  *.sh / *.py       ← optional: automation scripts
```

**SKILL.md frontmatter (required):**

```yaml
---
name: {skill-name}
description: {one-line — used for panel display and agent matching, max 200 chars}
category: {category}        # see Category List below
---
```

**SKILL.md body structure:**

```markdown
# {Skill Title}

{One sentence: what this skill does.}

## When to Use
{Trigger conditions — what the user says or what situation activates this.}

## What You Need Before Starting
{Prerequisites, inputs, context required.}

## Workflow
{Numbered steps. Each step: what to do, what tool to use, what output to produce.}

## Output
{What the skill produces — file paths, formats, deliverables.}

## Constraints
{Rules, things to never do, boundaries.}

## Common Mistakes
| Mistake | Fix |
|---|---|
| {pattern} | {correction} |
```

**Category list:**

| Category | Use for |
|---|---|
| `dev-skills` | Code review, testing, debugging, token optimization, skill creation |
| `business-analysis` | Market research, competitive intel, source evaluation |
| `business-modeling` | Statistical analysis, risk modeling, decision frameworks |
| `business-venture` | Validation sprints, marketing campaigns, launch playbooks |
| `business-intelligence` | Cross-project strategy, ecosystem orientation, memory curation |
| `creative-ideation` | Brainstorming, concept exploration, idea challenge |
| `marketing` | Persona profiling, channel strategy, messaging, campaigns |
| `ai-engineering` | .claude/ config auditing, prompt optimization, framework scaffolding |
| `dev-teams` | Development team orchestration |
| `language-articulation` | Voice, tone, writing style, translation |

---

### 3B — Team

**Directory:** `.claude/teams/{team-name}/`

**Required files:**

```
.claude/teams/{team-name}/
  config.json       ← entry point (required)
```

**config.json structure:**

```json
{
  "name": "{team-name}",
  "category": "{category}",
  "description": "{what this team does — max 200 chars for panel display}",
  "members": [
    {
      "name": "{agent-name}",
      "agentId": "{agent-name}",
      "agentType": "lead",
      "role": "{what this agent does, does NOT do, scope boundary}"
    },
    {
      "name": "{agent-name}",
      "agentId": "{agent-name}",
      "agentType": "teammate",
      "role": "{specific responsibility, inputs it needs, outputs it produces}"
    }
  ],
  "settings": {
    "teammateMode": "in-process",
    "maxTeammates": 5,
    "taskConfig": {
      "maxConcurrentTasksPerTeammate": 1,
      "maxActiveTeammates": 3
    },
    "policy": {
      "concurrencyRule": "Never more than 3 teammates active at once. {sequencing details}.",
      "outputRule": "{how outputs are reviewed and approved}"
    }
  }
}
```

**Rules:**
- Every team MUST have exactly one `"agentType": "lead"`
- `maxActiveTeammates` is always `3` (project rule)
- Each member needs a matching command file in `.claude/commands/{agent-name}.md`

---

### 3C — Team Orchestrator Skill

Every team needs a SKILL.md so it appears in the skills panel with proper description.

**Directory:** `.claude/skills/team-{team-name}/`

**SKILL.md frontmatter:**

```yaml
---
name: team-{team-name}
description: {Team Name} Team Orchestrator — {what the team does}
---
```

**Body must include:**
1. When to Use
2. What You Need Before Starting
3. What This Team Produces
4. Agent Sequence (numbered, with agent names)
5. Key Rules (what NOT to do)

---

### 3D — Command (Agent Role)

**File:** `.claude/commands/{agent-name}.md`

**Frontmatter:**

```yaml
---
description: "{agent role} — {what it does in one line}"
allowed-tools: ["Read", "Glob", "Grep", "WebSearch"]
---
```

**Body structure:**

```markdown
# Command: {agent-name}

You are the **{agent-name}** agent on the {Team} team. You {DO} — you do not {BOUNDARY}.

## What You Do NOT Do
- No {X} (→ {other-agent})
- No {Y} (→ {other-agent})

## Your Task
{Specific instructions for this agent's work.}

## Output
{What this agent produces and where it goes.}
```

---

### 3E — Workflow

**Directory:** `.claude/workflow-team-library/{workflow-name}/`

**Required files:**

```
.claude/workflow-team-library/{workflow-name}/
  manifest.md        ← entry point (required)
  core/              ← shared rules loaded by all agents
  {phase}/           ← one directory per workflow phase
  ops/               ← operational guides (how-to-run, quick-start)
  synthesis/         ← final synthesis modules
```

**manifest.md structure:**

```markdown
# MANIFEST — {Workflow Name}
Version: 1.0
Modes: {FORWARD | REVERSE | LOOP | LINEAR}

## LOAD ORDER
1. Always load ALL core/ modules first
2. {sequencing rules}

## CORE (always load)
core/{module-name}    {one-line description}

## {PHASE NAME} MODULES
  {phase}/{module}    {description}
```

**Rules:**
- Workflows are team methodologies — they tell a team HOW to work
- A workflow must have a matching team in `.claude/teams/` and orchestrator in `.claude/skills/team-{name}/`
- The workflow folder name must match a key in `WORKFLOW_CATEGORIES` in `skills-service.ts` or it defaults to `'workflows'`

---

## Step 4 — Register

After creating any artifact:

1. **Update `index.json`** — add entry to `.claude/skills/index.json`
2. **Update `index.md`** — add one-line entry to `.claude/skills/index.md` under the right section
3. **Verify discovery** — the SkillsService scans these paths:
   - Skills: `.claude/skills/{name}/SKILL.md` (frontmatter `category:` field)
   - Teams: `.claude/teams/{name}/config.json` (`"category"` field)
   - Workflows: `.claude/workflow-team-library/{name}/manifest.md` (`WORKFLOW_CATEGORIES` map)
   - Commands: `.claude/commands/{name}.md` (not in skills panel — invoked via `/command`)

## Step 5 — Verify

Before declaring done:

- [ ] Entry point file exists in the correct directory
- [ ] Frontmatter has `name`, `description`, and `category` (skills) or `"category"` (teams)
- [ ] If team: every member has a matching `.claude/commands/{name}.md`
- [ ] If team: orchestrator SKILL.md exists in `.claude/skills/team-{name}/`
- [ ] `index.json` updated
- [ ] `index.md` updated
- [ ] No duplicate IDs across skills, teams, and workflows
- [ ] User has reviewed all files before commit

## Constraints

- **Never commit without user review** — always show the files for approval first
- **Never create a team without commands for every member**
- **Never skip the reverse-engineering step** — understand the outcome before writing files
- **5-turn websearch limit** — if research fails after 5 rounds, inform the user
- **No assumptions** — if conflicting data appears, ask the user before proceeding
