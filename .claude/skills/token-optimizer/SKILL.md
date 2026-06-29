---
name: token-optimizer
description: Use when reviewing AI instruction files for token waste, before applying instruction changes, or when the weekly audit report is due. Classifies content, scores Token Efficiency, and guides the 5-gate pipeline.
---

# Token Optimizer

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

## 5-Gate Analysis Procedure

Run gates in order. Never skip. Never apply without all gates passing.

1. **--dry-run** — Generate preview in tmp/token-preview/. Show diff + token counts + TES per file. Human reviews.
2. **--judge** — LLM-as-judge scores intent preservation: PASS / PARTIAL / FAIL. MANDATORY. Blocks on FAIL or PARTIAL.
3. **--baseline** — Capture current instruction behavior on test-scenarios.md (run once, stored in .token-audit-baselines/).
4. **--test** — Run proposed instructions on same scenarios. Compare to baseline. MANDATORY. Blocks on REGRESSION.
5. **--apply** — Move originals to human/, write optimized versions. Only available after gates 2+4 PASS.

## Report Format

Each report includes:
1. Token Counts — per file: before, after, CR, TES
2. Drift Flags — human/ vs live version divergence
3. Recommendations — ranked by TES impact, with exact token savings

## Stuck Detection (PostToolUse mode)

Agent is stuck when in last N tool calls:
- Same tool type 3+ consecutive times, no Write/Edit/Bash in between
- OR 5+ tool calls since last file modification
- OR same error pattern in 2 consecutive tool outputs

When stuck detected: surface this skill for token-efficiency review of current session context.
