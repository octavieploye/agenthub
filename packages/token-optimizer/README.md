# Token Optimizer

A universal, installable tool for auditing and compressing AI instruction files (CLAUDE.md, AGENT.md, skill files) without losing behavioral fidelity.

Designed for multi-agent systems where instruction bloat directly increases cost, latency, and context window pressure.

## What It Does

1. **Scans** all LLM-directed `.md` files in a project
2. **Classifies** each file/section as Rules, Context, Workflow, or Human-facing
3. **Scores** compression potential using TES (Token Efficiency Score = Compression Ratio x Quality Retention)
4. **Guides** you through a 5-gate rewrite pipeline with safety checks before any file is overwritten
5. **Archives** originals to `human/` so nothing is lost
6. **Rotates** the audit log automatically (keeps last 5 sessions)

The shell script handles file discovery, token counting, gate enforcement, and archiving. The LLM does all analysis and rewriting.

## Package Contents

```
token-optimizer/
  README.md              This file
  SKILL.md               Skill definition loaded by Claude Code / agents
  criteria.md            Compression targets, QR floors, KEEPLIST patterns, profile config
  token-audit.sh         Main shell script (all modes)
  test-scenarios.md      10 behavioral test scenarios for Gate 4 validation
  hooks-snippet.json     Stop hook definition (session-end audit)
  install.sh             Installer — copies files, merges hooks, creates directories
  profiles/              Per-domain compression profiles
    coding.conf          Default — dev agents, scouts, testers (conservative)
    business.conf        Strategy, market research, CEO advisory (moderate context compression)
    marketing.conf       Persona, channel, content, campaign (aggressive context compression)
    risk.conf            Security, risk, compliance (minimal compression, high QR floors)
    stats.conf           Quant, data, decision modeling (preserve schemas and formulas)
  tests/                 Package self-tests
    test_token_counting.sh   Token count accuracy and session-end mode
    test_apply_gate.sh       Gate enforcement and apply flow
    test_install.sh          Installer creates correct structure
    test_scaffold.sh         Scaffold verification
  current-system-countercheck/   External research (Perplexity, Gemini insights)
```

## Install

```bash
# From the token-optimizer package directory:
./install.sh /path/to/your/project

# Or from any directory:
packages/token-optimizer/install.sh /path/to/your/project
```

This copies files to `.claude/skills/token-optimizer/`, merges the Stop hook into `settings.json`, and creates the `human/` archive directory. It will prompt you to add gitignore entries manually.

## Usage

### Quick status
```bash
.claude/skills/token-optimizer/token-audit.sh --status
```

### Scan (Gate 1)
```bash
.claude/skills/token-optimizer/token-audit.sh --dry-run
# With a specific profile:
.claude/skills/token-optimizer/token-audit.sh --dry-run --profile=marketing
```

### Full 5-gate pipeline

| Gate | What | Who |
|------|-------|-----|
| 1. Scan | `--dry-run` lists files, token counts, CR targets | Shell |
| 2. Rewrite | Read each file, rewrite to CR target, save to `tmp/token-preview/` | LLM |
| 3. Judge | Verify all behavioral directives preserved, KEEPLIST lines intact | LLM |
| 4. Test | Run 10 behavioral scenarios against proposed instructions | LLM |
| 5. Apply | `--apply` archives originals, writes optimized versions | Shell |

Gates 3 and 4 must both PASS before `--apply` is unblocked:
```bash
token-audit.sh --mode=set-gate --gate=judge --verdict=PASS
token-audit.sh --mode=set-gate --gate=test --verdict=PASS
token-audit.sh --apply
```

## Agent Profiles

Profiles override CR targets and QR floors for different agent types. Use `--profile=<name>` with any mode.

| Profile | CR Context | QR Floor Rules | Best for |
|---------|-----------|----------------|----------|
| coding | 1.5x | 0.98 | Dev agents, scouts, testers |
| business | 2.0x | 0.98 | Strategy, market research |
| marketing | 2.5x | 0.98 | Persona, content, campaigns |
| risk | 1.3x | 0.99 | Security, compliance |
| stats | 1.5x | 0.98 | Quant analysis, data modeling |

To add a custom profile, create `profiles/<name>.conf` with shell-sourceable `CR_*` and `QR_FLOOR_*` variables.

## KEEPLIST

Lines matching KEEPLIST patterns in `criteria.md` are protected from compression. Default patterns:

- Markdown headings (`# `, `## `, `### `)
- Table rows (`|...|`)
- Code fence boundaries (` ``` `)
- Behavioral directives (`NEVER`, `ALWAYS`, `MUST NOT`, `DO NOT`)
- Port numbers (`:8000`, `:9400`)
- DB schema tokens (`PRIMARY KEY`, `FOREIGN KEY`, `DEFAULT`)
- Universal status vocabulary (`queued`, `pending`, `in_progress`, etc.)

## Log Rotation

The audit log (`token-audit-log.md`) auto-rotates on each session-end. Only the last 5 sessions are kept. Older sessions are archived to `token-audit-log-rotated-YYYYMMDD.md`. Configure via `MAX_AUDIT_SESSIONS` in `criteria.md`.

## Running Tests

```bash
bash packages/token-optimizer/tests/test_token_counting.sh
bash packages/token-optimizer/tests/test_apply_gate.sh
bash packages/token-optimizer/tests/test_install.sh
```
