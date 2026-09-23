---
name: token-optimizer
description: Use when reviewing AI instruction files for token waste, before applying instruction changes, or when the weekly audit report is due. Classifies content, scores Token Efficiency, and guides the 5-gate pipeline.
category: dev-skills
---

# Token Optimizer

**YOU are the LLM.** This skill guides you through auditing and rewriting AI instruction files.
The shell script (`token-audit.sh`) handles only mechanical operations — file discovery, token counting, gate status, log rotation, archiving. All analysis and rewriting is done by you.

## When to Use
- Manually: when you want to audit .claude/ instruction files for waste
- Automatically: invoked by Stop hook (session-end)
- Before editing any CLAUDE.md or entity instruction file

## Quick Status Check
```bash
.claude/skills/token-optimizer/token-audit.sh --status
```
Shows: last audit timestamp, total tokens, gate status, pending rewrites, available profiles.

## Agent Profiles

Different agent types have different compression tolerance. Use `--profile=<name>` with any mode to load domain-specific CR targets and QR floors.

| Profile | Agents | CR Context | QR Floor Rules |
|---|---|---|---|
| coding (default) | dev-stack, scouts, testers | 1.5x | 0.98 |
| business | strategist, market-researcher, ceo-advisor | 2.0x | 0.98 |
| marketing | persona-profiler, channel-strategist, content-creator | 2.5x | 0.98 |
| risk | sec-devops, risk-analyst, risk-modeler | 1.3x | 0.99 |
| stats | quant-analyst, decision-modeler, data-architect | 1.5x | 0.98 |

Example: `token-audit.sh --dry-run --profile=marketing`

## Content Classification

Classify each file or section before scoring:

| Class | Markers | CR target (from criteria.md) |
|---|---|---|
| Rules | NEVER, ALWAYS, MUST, DO NOT | CR_RULES |
| Context | architecture, port registry, DB schema, entity definitions | CR_CONTEXT |
| Workflow | numbered steps, checklists, if/then agent flows | CR_WORKFLOW |
| Human-facing | how-to docs, reports, responses, commit messages | CR_HUMAN (no compression) |

Flag for aggressive compression: narrative prose in LLM-directed files (mythology, philosophy, brand framing). These have near-zero behavioral value.

**KEEPLIST**: Lines matching patterns in `criteria.md` KEEPLIST_PATTERNS must NEVER be compressed or removed. These include: markdown headings, table rows, code fences, behavioral directives (NEVER/ALWAYS/MUST), port numbers, DB schema tokens, status vocabulary.

## TES Calculation

```
CR  = tokens_before / tokens_after   (chars_before/4 / chars_after/4)
QR  = 1 - (error_rate + stuck_rate + retry_rate) / 3
TES = CR x QR

TES > 1.0 = improvement
TES < 1.0 = regression (stop, review)
```

## 5-Gate Pipeline

Run gates in order. Never skip. Never apply without both gates passing.

### Gate 1 — Scan (`--dry-run`)
```bash
.claude/skills/token-optimizer/token-audit.sh --dry-run
```
Shows each LLM-directed file with its current token count and CR target.

### Gate 2 — Rewrite (YOU)
For each file from the scan:
1. Read the file
2. Identify KEEPLIST lines — these are untouchable
3. Rewrite remaining content to the CR target — remove narrative, rationale, examples that don't change agent behavior; use imperative sentences; preserve ALL behavioral directives exactly
4. Write your proposed version to: `tmp/token-preview/<rel>.proposed.md`

### Gate 3 — Judge (YOU) -> mark gate
After rewriting, judge your own output:
- **PASS**: all rules, constraints, and behavioral requirements are preserved; all KEEPLIST lines intact
- **PARTIAL**: minor nuance loss but core behavior preserved -> revise and retry
- **FAIL**: any behavioral directive missing or weakened -> revise and retry

Once all files score PASS:
```bash
.claude/skills/token-optimizer/token-audit.sh --mode=set-gate --gate=judge --verdict=PASS
```

### Gate 4 — Behavioral test (YOU) -> mark gate
Read `test-scenarios.md`. For each scenario, simulate an agent following your proposed instructions and verify the compliance check passes. If all scenarios pass:
```bash
.claude/skills/token-optimizer/token-audit.sh --mode=set-gate --gate=test --verdict=PASS
```
If any scenario regresses: revise the proposed file and repeat from Gate 3.

### Gate 5 — Apply
```bash
.claude/skills/token-optimizer/token-audit.sh --apply
```
Archives originals to `human/`, writes optimized versions in place. Blocked unless both gate 3 and gate 4 are PASS.

## Log Rotation

The audit log auto-rotates on each session-end. Only the last 5 sessions are kept in the active log. Older sessions are archived to `token-audit-log-rotated-YYYYMMDD.md`.

## Report Format

Each report includes:
1. Token Counts — per file: before, after, CR, TES
2. Drift Flags — human/ vs live version divergence
3. Recommendations — ranked by TES impact, with exact token savings
