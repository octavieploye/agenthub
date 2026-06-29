---
name: token-optimizer
description: Use when reviewing AI instruction files for token waste, before applying instruction changes, or when the weekly audit report is due. Classifies content, scores Token Efficiency, and guides the 5-gate pipeline.
---

# Token Optimizer

**YOU are the LLM.** This skill guides you through auditing and rewriting AI instruction files.
The shell script (`token-audit.sh`) handles only mechanical operations — file discovery, token counting, gate status, archiving. All analysis and rewriting is done by you.

## When to Use
- Manually: when you want to audit .claude/ instruction files for waste
- Automatically: invoked by PostToolUse (stuck), Stop (session-end), and cron (Friday 8am)
- Before editing any CLAUDE.md or entity instruction file

## Content Classification

Classify each file or section before scoring:

| Class | Markers | CR target (from criteria.md) |
|---|---|---|
| Rules | NEVER, ALWAYS, MUST, DO NOT | CR_RULES |
| Context | architecture, port registry, DB schema, entity definitions | CR_CONTEXT |
| Workflow | numbered steps, checklists, if/then agent flows | CR_WORKFLOW |
| Human-facing | how-to docs, reports, responses, commit messages | CR_HUMAN (no compression) |

Flag for aggressive compression: narrative prose in LLM-directed files (mythology, philosophy, brand framing). These have near-zero behavioral value.

## TES Calculation

```
CR  = tokens_before / tokens_after   (chars_before/4 ÷ chars_after/4)
QR  = 1 - (error_rate + stuck_rate + retry_rate) / 3
TES = CR × QR

TES > 1.0 → improvement
TES < 1.0 → regression (stop, review)
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
2. Rewrite it to the CR target — remove narrative, rationale, examples that don't change agent behavior; use imperative sentences; preserve ALL behavioral directives exactly
3. Write your proposed version to: `tmp/token-preview/<rel>.proposed.md`
   - Example: file `.claude/CLAUDE.md` → proposed at `tmp/token-preview/.claude/CLAUDE.md.proposed.md`

### Gate 3 — Judge (YOU) → mark gate
After rewriting, judge your own output:
- **PASS**: all rules, constraints, and behavioral requirements are preserved
- **PARTIAL**: minor nuance loss but core behavior preserved → revise and retry
- **FAIL**: any behavioral directive missing or weakened → revise and retry

Once all files score PASS:
```bash
.claude/skills/token-optimizer/token-audit.sh --mode=set-gate --gate=judge --verdict=PASS
```

### Gate 4 — Behavioral test (YOU) → mark gate
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

## Report Format

Each report includes:
1. Token Counts — per file: before, after, CR, TES
2. Drift Flags — human/ vs live version divergence
3. Recommendations — ranked by TES impact, with exact token savings

