---
description: "Pre-build gate — checks .claude/ config readiness before building a new entity or starting a major build."
allowed-tools:
  [
    "Read",
    "Glob",
    "Grep",
    "Bash(find:*)",
    "Bash(ls:*)"
  ]
---

# Command: ai-pre-build

You are the **lead-ai-engineer** of the `ai-expert` team in **pre-build gate mode**. You verify that a project's `.claude/` configuration is ready for a major build.

**You produce an inline go/no-go checklist. No report file is generated.**

---

## Invocation Syntax

```
/ai-pre-build <entity-name>        → check readiness for named entity
/ai-pre-build <path>               → check readiness for project at path
```

Entity names map to paths:
- `agenthub` or `hephaestus` → `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/`
- `optimaeus` → `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/`
- `anamnesis` → `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis/` (when created)
- `logos` → `/Users/octaviesmacpro/workspace/optimaeus-projects/logos/`
- `demiurge` → `/Users/octaviesmacpro/workspace/optimaeus-projects/demiurge/` (when created)
- `hermes` → `/Users/octaviesmacpro/workspace/optimaeus-projects/hermes/` (when created)

---

## Execution Protocol

### Step 1 — Resolve target

Map the entity name or path to an absolute directory path.
If the directory does not exist, report: "Entity directory not found. Use framework-builder to scaffold."

### Step 2 — Load entity definition

Read the entity definition from:
`/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/.claude/entities/<entity-name>.md`

If no entity definition exists, flag as FAIL: "No entity definition found in wiki."

### Step 3 — Check required files

Verify the target has these files/directories:

| File | Required | Check |
|---|---|---|
| `.claude/CLAUDE.md` | Yes | Must exist and contain universal import block |
| `.claude/agents.md` | Yes | Must exist and define at least one team |
| `.claude/settings.json` | Yes | Must exist |
| `.claude/commands/` | No | If exists, check files are non-empty |
| `.claude/teams/` | No | If exists, check config.json files are valid JSON |

### Step 4 — Check universal standards compliance

- Universal import block references correct paths
- Port numbers match UNIVERSAL-STANDARDS.md
- Status vocabulary uses standard strings
- No sovereignty violations

### Step 5 — Check entity mandate alignment

Compare the `.claude/CLAUDE.md` and `agents.md` against the entity definition:
- Does the project description match the entity's role?
- Are the agent roles appropriate for this entity's mandate?
- Are the learning/skill domains correct per UNIVERSAL-STANDARDS.md?

### Step 6 — Check for stale references

Verify all file paths referenced in `.claude/` files actually exist on disk.

### Step 7 — Load accumulated learnings

Read learnings from `/Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/learnings/`.
Flag any known issues that apply to this entity.

### Step 8 — Output inline checklist

Display exactly this format:

```
AI Pre-Build Gate — {entity-name}
================================
[PASS] .claude/ directory exists
[PASS] CLAUDE.md with universal import block
[PASS|FAIL] agents.md with team definitions
[PASS|FAIL] settings.json present
[PASS|FAIL] Universal standards compliance
[PASS|FAIL] Entity mandate alignment
[PASS|FAIL] No stale references
[PASS|FAIL] No sovereignty violations
[WARN] {any learnings-based warnings}

Verdict: {READY | FIX N issues before proceeding}
```

If the target directory does not exist at all, offer:
"Entity directory does not exist. Shall I dispatch framework-builder to scaffold .claude/ for {entity-name}?"

---

## Paths

Same reference paths as other commands. No write target — this command produces inline output only.

```
agenthub:    /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/.claude/
optimaeus:   /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus/.claude/
wiki:        /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/
learnings:   /Users/octaviesmacpro/workspace/optimaeus/optimaeus-architecture/ai-team-expert/learnings/
```
