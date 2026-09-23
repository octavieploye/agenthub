---
name: market-modeling
description: Use when researching market structure before a Demiurge brief, validating market assumptions, or running a convergence check across five economic knowledge traditions. Launches /modelise for the full 4-phase workflow (Harvest → Analysis → Shadow → Synthesis) or /modelise-quick for rapid orientation. Never a single lens. Never a corporate source as ground truth. Never a point prediction.
---

# Market Modeling

## LLM Compatibility

| Mode | LLM used |
|---|---|
| Interactive (Claude Code session) | You — reads the workflow files and runs real web research via WebSearch + WebFetch |
| CLI (market-modeling-run.sh) | Ollama local first, then Anthropic REST key if set |

CLI mode priority:
1. **Ollama** (`OLLAMA_URL`, default `http://localhost:11434`) — sovereign, no key; set `OLLAMA_MODEL` (default `llama3.2`)
2. **Anthropic REST key** — only if `ANTHROPIC_API_KEY` is a REST key (`sk-ant-api03-*`); Claude Code OAuth keys (`sk-ant-oat01-*`) do not work here

Interactive mode is strongly preferred: it runs real WebSearch + WebFetch against live sources. CLI mode runs through LLM training knowledge — suitable for orientation, not for Demiurge briefs.

## When to Use

- Before writing any Demiurge brief that involves a market judgment
- When validating market assumptions already present in a draft brief
- When a convergence check is needed — five independent traditions must agree before a finding is load-bearing
- When a Shadow adversarial review of a market analysis is needed

## Commands

| Command | What it runs |
|---|---|
| `/modelise` | Full 4-phase workflow — Harvest → Analysis → Shadow → Synthesis |
| `/modelise-quick` | Rapid 2-phase orientation — abbreviated harvest + synthesis (flagged [QUICK SCAN]) |
| `/modelise-shadow` | Shadow adversarial review of any provided analysis |

## CLI

```bash
# Full run (interactive Claude session)
./market-modeling-run.sh "your market question"

# Full run — named directory
./market-modeling-run.sh --question "your question" myrun

# Quick orientation
./market-modeling-run.sh --quick "your question"

# Resume from a specific phase
./market-modeling-run.sh --from 3 --run-dir .market-modeling-runs/20260629-1400-myrun
```

## The Five-Lens Framework

| Lens | What it sees | What it misses |
|---|---|---|
| Equilibrium (PE/CGE) | Supply-demand structure, elasticities, cross-market effects | Endogenous crises, heterogeneity, distribution |
| Dynamic (DSGE/VAR) | Time-series dynamics, shock transmission, impulse responses | Path dependence, financial fragility |
| Agent-Based / Complexity | Emergent phenomena, lock-in, boom-bust, herding | Predictive power at turning points |
| Post-Keynesian / Minsky | Financial fragility, monopoly pricing, sectoral balance sheets | Efficient allocation, equilibrium stability |
| Ecological / True Cost | Externalized costs, natural capital depletion, throughput | Conventional optimality |

## Source Convergence Rule

A finding is **load-bearing** when confirmed by sources from at least 3 of 5 traditions. Fewer than 5 non-corporate sources — all findings flagged `[BELOW CONVERGENCE THRESHOLD]`.

## What This Workflow Does NOT Produce

- Point predictions dressed as conclusions
- Summary verdicts that flatten productive tension
- Corporate research treated as authoritative ground
- Confidence ratings in percentages
- Triage tables (CRITICAL / SIGNIFICANT / OPEN)
- Output that looks like a corporate research report

## Output Format

### Synthesis (Phase 4) — Final Deliverable

```
MARKET MODEL SYNTHESIS — [Subject]
===================================

CONVERGENCE TABLE
| Finding | Equilibrium | Dynamic | Agent-Based | Post-Keynesian | Ecological | Lenses confirming |
|---|---|---|---|---|---|---|
[all findings — minimum 5 rows]

Load-bearing threshold: ≥3 of 5 lenses must confirm.
Findings below threshold flagged [BELOW CONVERGENCE THRESHOLD].

ASSUMPTION REGISTER
| # | Assumption | Source tradition | Confidence (GRADE) | What would falsify it |
|---|---|---|---|---|
[all assumptions surfaced during analysis]

GRADE scale:
  HIGH    — consistent evidence from ≥3 traditions, no contradiction
  MODERATE — evidence from 2 traditions, minor contradictions
  LOW     — single tradition or significant contradictions
  VERY LOW — extrapolation, no direct evidence

EVIDENCE QUALITY TABLE
| Source | Type | Tradition | Date | Corporate? | Weight |
|---|---|---|---|---|---|
[all sources cited — corporate sources weighted 0.5x, non-corporate 1.0x]

PRODUCTIVE TENSIONS
  [List findings where traditions genuinely disagree — do NOT flatten]
  1. [Tradition A says X because... vs Tradition B says Y because...]
  2. [...]

SHADOW REVIEW SUMMARY (if /modelise-shadow was run)
  Strongest challenge:    [the finding the shadow reviewer most credibly attacked]
  Weakest assumption:     [the assumption most vulnerable to falsification]
  Verdict shift:          [did the shadow review change any finding from load-bearing to contested?]
```

### Quick Scan (/modelise-quick) — Abbreviated Output

Same structure as above but:
- Convergence table: minimum 3 rows (vs 5)
- Assumption register: top 3 only
- Evidence quality table: omitted
- All findings flagged `[QUICK SCAN — not load-bearing without full run]`
