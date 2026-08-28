---
name: prompt-ready
description: Generate a ready-to-paste execution prompt with repo path, skill, scope, constraints, and model recommendation — for dispatching work to a new session
category: dev-skills
---

# Prompt Ready

Generate a self-contained, copy-pasteable prompt for dispatching a task to a new Claude session with the right model. Called after a plan is written or a conversation identifies work to hand off.

## When to Use

- You just created a plan (UX plan, UI plan, sprint plan, feature brief) and want to hand it off
- A conversation identified discrete work items that should run in separate sessions
- User says "create a prompt for this" or "make this dispatchable"
- User invokes `/prompt-ready`

## What You Need Before Starting

- **Target repo** — full absolute path (from the Repo Gate table in CLAUDE.md)
- **Skill to invoke** — which skill the agent should run (e.g. team-ux-challenge, team-ui-builder, team-dev-loop)
- **Scope** — what pages/files/features are in scope
- **Context docs** — which files the agent must read before starting
- **Constraints** — rules the agent must follow

If any of these are missing, extract them from the plan file or conversation. If still ambiguous, ask the user.

## Workflow

### Step 1 — Identify the Task

Read the plan or conversation context. Extract:
- What outcome is expected (UX plan, UI plan, code, audit)
- Which repo it targets
- Which skill should execute it
- What files are in scope
- What docs must be read first

### Step 2 — Score Complexity

Count these signals from the task:

| Signal | Source | Weight |
|---|---|---|
| Cross-reference docs (files to READ BEFORE STARTING) | Plan references | ×2 |
| Decision rows (if UX plan) | Decision table | ×0.5 |
| Pages in scope | Scope list | ×1 |
| DRS amendments to track | Amendment sections | ×1 |
| Cross-cluster/cross-module dependencies | Dependency sections | ×1 |
| Unique layouts needed (not template application) | Plan notes | ×2 |

```
score = (cross_refs × 2) + (decisions × 0.5) + pages + amendments + dependencies + (unique_layouts × 2)
```

### Step 3 — Recommend Model

| Score | Model | Reasoning |
|---|---|---|
| >= 20 | Opus 4.6 | Heavy cross-referencing, architectural decisions, 30+ constraints |
| 8–19 | Sonnet 4.6 | Standard plans, component specs, moderate constraint tracking |
| < 8 | Haiku 4.5 | Template-driven, palette swaps, single-doc transforms, pattern application |

For Ollama Cloud (sovereignty/cost):
- Haiku-tier tasks can use Gemma 27B or Qwen 32B if user prefers local
- Sonnet-tier tasks: Mistral Large (EU cloud) if sovereignty required
- Opus-tier tasks: no local equivalent — use Opus

### Step 4 — Build the Prompt

Format:

```
Repo: {full absolute path}
Skill: /{skill-name}

Scope: {cluster/feature name} — {brief description}. {N} pages/files:
- {page/file 1}
- {page/file 2}
- ...

READ BEFORE STARTING:
- {doc 1} ({why — e.g. "LOCKED design constitution"})
- {doc 2} ({why})
- ...

Output: {output file path}

Constraints:
- {constraint 1}
- {constraint 2}
- ...
```

Rules for the prompt:
- **No prose** — bullet points and paths only
- **Full absolute paths** for all files
- **Constraints are reminders** — pull from the plan's non-negotiable section, DRS amendments, and cross-cluster rules
- **One skill per prompt** — never combine two skills in one prompt
- **One scope unit per prompt** — one cluster, one feature, one page group

### Step 5 — Present to User

Show the prompt in a fenced code block with:
1. **Model recommendation** and why (one line above the code block)
2. The prompt itself (copy-pasteable)
3. If multiple prompts: show them in execution order

Do NOT write the prompt to any file. The user copies it and opens a new session.

## Batch Mode

When generating prompts for multiple clusters/features:

1. Generate one prompt per scope unit × phase (e.g. C6 UX, C6 UI = 2 prompts)
2. Show all prompts in recommended execution order
3. Include a summary table: `| Prompt | Model | Why |`

## Constraints

- NEVER embed the prompt in a plan file — show it to the user only
- NEVER combine multiple skills in one prompt
- NEVER combine multiple clusters/features in one prompt (unless they share a single template)
- Always use full absolute repo paths from the Repo Gate table
- Always include the skill invocation line (`Skill: /team-ux-challenge`)
- Keep constraints to 5-8 bullet points — only the ones that prevent common mistakes
- If the plan references DRS amendments from other clusters, include those as constraints

## Common Mistakes

| Mistake | Fix |
|---|---|
| Combining C4+C5 into one prompt | One scope unit per prompt — split them |
| Writing the prompt to a file | Show in conversation only — user copies it |
| Forgetting the skill invocation line | Always include `Skill: /{skill-name}` |
| Using relative paths | All paths must be full absolute paths |
| Including 15+ constraints | Keep to 5-8 — only the mistake-preventing ones |
| Recommending Haiku for cross-reference-heavy work | Score the complexity — if >= 8, use Sonnet |
| Not checking Repo Gate table | Verify the repo path exists in CLAUDE.md's Repo Gate |
