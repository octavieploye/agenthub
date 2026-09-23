---
name: package-factory
description: Design and generate complete agenthub packages from a brief — workflow or tool type
---

# Package Factory

Scaffolds and generates agenthub packages. Two types supported:

| Type | Pattern | Entry point | When to use |
|---|---|---|---|
| `workflow` | market-modeling | `/create-package` → slash commands + `claude --print` runner | Multi-phase team workflows with gates |
| `tool` | token-optimizer | `/create-package` → bash script with `--mode` flags | Script-driven tools with LLM calls |

## Commands

| Command | What it does |
|---|---|
| `/create-package` | Collect brief → design → scaffold → write all package files |

## What this package produces

For a `workflow` package:
- `.claude/commands/` — slash commands for Claude Code
- `.claude/workflow-team-library/<name>/` — phase files, team, manifest, handoffs
- `<name>-run.sh` — CLI runner using `claude --print`
- `add-to-project.sh` — deployment via rsync
- `tests/` — install + scenario tests

For a `tool` package:
- `<name>.sh` — main bash script with `--mode` dispatcher
- `install.sh` — copies to `.claude/skills/<name>/`, merges hooks
- `tests/` — install + scenario tests

## What this package does not do

- Does not generate without a confirmed brief
- Does not write placeholder content — every file is specific to the package purpose
- Does not skip tests
- Does not install itself into projects automatically
