#!/usr/bin/env bash
set -euo pipefail

# ── Locate package ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIBRARY="$SCRIPT_DIR/.claude/workflow-team-library/market-modeling"
CRITERIA="$SCRIPT_DIR/criteria.md"

# Source config defaults (MM_MODEL, RUNS_DIR, etc.)
source <(grep -E '^(MM_MODEL|RUNS_DIR)' "$CRITERIA" 2>/dev/null || true)
MM_MODEL="${MM_MODEL:-claude-sonnet-4-6}"
RUNS_DIR="${RUNS_DIR:-$(pwd)/market-modeling-runs}"

# ── Parse arguments ───────────────────────────────────────────────────────────
QUESTION=""
RUN_DIR=""
QUICK=false
RUN_NAME=""

for arg in "$@"; do
  case "$arg" in
    --question=*) QUESTION="${arg#--question=}" ;;
    --run-dir=*)  RUN_DIR="${arg#--run-dir=}" ;;
    --quick)      QUICK=true ;;
    --help|-h)
      echo "Usage: market-modeling-run.sh [options] [run-name]"
      echo ""
      echo "Options:"
      echo "  --question=\"...\"    Market question to analyze (required)"
      echo "  --run-dir=PATH      Directory to store phase outputs"
      echo "                      (default: market-modeling-runs/<run-name>)"
      echo "  --quick             Abbreviated scan — 2-3 sources, 3 lenses, no shadow step"
      echo "  --help              Show this help"
      echo ""
      echo "Example:"
      echo "  market-modeling-run.sh --question=\"How does the EV battery market operate?\" ev-batteries"
      echo "  market-modeling-run.sh --quick --question=\"Coffee market structure\" coffee-quick"
      exit 0 ;;
    --*) : ;;
    *)   RUN_NAME="$arg" ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
if [[ -z "$QUESTION" ]]; then
  echo "ERROR: --question is required."
  echo "Usage: market-modeling-run.sh --question=\"...\" [run-name]"
  exit 1
fi

command -v claude > /dev/null 2>&1 || { echo "ERROR: claude CLI is required but not installed."; exit 1; }

RUN_NAME="${RUN_NAME:-run-$(date +%Y%m%d-%H%M%S)}"
RUN_DIR="${RUN_DIR:-$RUNS_DIR/$RUN_NAME}"
mkdir -p "$RUN_DIR"

echo "Market Modeling — $RUN_NAME"
echo "Question: $QUESTION"
echo "Run directory: $RUN_DIR"
[[ "$QUICK" == "true" ]] && echo "Mode: QUICK SCAN (abbreviated — not convergence-validated)"
echo ""

# ── LLM phase runner ──────────────────────────────────────────────────────────
run_phase() {
  local phase_name="$1"
  local prompt_file="$2"
  local out="$RUN_DIR/$phase_name-output.md"

  echo "[$phase_name] Running..."

  claude --print \
    --permission-mode bypassPermissions \
    --allowed-tools "WebSearch,WebFetch,Read,Write" \
    < "$prompt_file" \
    > "$out"

  echo "[$phase_name] Done — $out"
  echo ""
}

# ── Prompt builders ───────────────────────────────────────────────────────────
build_phase1_prompt() {
  cat > "$RUN_DIR/prompt-phase1.txt" <<PROMPT
You are the Phase 1 Harvest team for a market intelligence run.

RESEARCH QUESTION: $QUESTION

Instructions are in: $LIBRARY/phase-1-harvest.md
Team definitions are in: $LIBRARY/team.md

Run all three harvesters simultaneously:
- Harvester A: academic/quantitative sources (nber.org, arxiv.org, ssrn.com, aeaweb.org, ideas.repec.org)
- Harvester B: official/institutional sources (imf.org, worldbank.org, oecd.org, bis.org, ecb.europa.eu)
- Harvester C: heterodox/complexity sources (santafe.edu, inet.ox.ac.uk, levyinstitute.org, stockholmresilience.org)

Use WebSearch and WebFetch to retrieve real, accessible sources. Complete all source cards per the format in phase-1-harvest.md. Complete the HARVEST-OUTPUT checklist. Run Gate 1 check before writing output.

Write the full HARVEST-OUTPUT to: $RUN_DIR/phase-1-output.md
PROMPT
}

build_phase2_prompt() {
  cat > "$RUN_DIR/prompt-phase2.txt" <<PROMPT
You are the Phase 2 Analyst for a market intelligence run.

RESEARCH QUESTION: $QUESTION

Instructions are in: $LIBRARY/phase-2-analysis.md
Harvest output is in: $RUN_DIR/phase-1-output.md

Apply all five lenses to the harvested intelligence:
- Lens 1: Equilibrium (PE/CGE) — supply/demand structure, elasticities, GE effects
- Lens 2: Dynamic (DSGE/VAR) — shock transmission, impulse responses, time-series dynamics
- Lens 3: Agent-Based / Complexity — lock-in, herding, emergent phenomena, path dependence
- Lens 4: Post-Keynesian / Minsky — financial fragility, degree of monopoly, endogenous money
- Lens 5: Ecological / True Cost — externalities, natural capital depletion, throughput costs

For each lens: state what it sees AND what it structurally cannot see. If the harvest is silent on a lens, name that silence as a finding — do not skip the lens. Complete cross-lens observations. Run Gate 2 check.

Write the full FIVE-LENS ANALYSIS to: $RUN_DIR/phase-2-output.md
PROMPT
}

build_phase3_prompt() {
  cat > "$RUN_DIR/prompt-phase3.txt" <<PROMPT
You are the Phase 3 Shadow for a market intelligence run.

RESEARCH QUESTION: $QUESTION

Instructions are in: $LIBRARY/phase-3-shadow.md
Harvest output is in: $RUN_DIR/phase-1-output.md
Analysis output is in: $RUN_DIR/phase-2-output.md

Answer all seven Shadow questions. Name mechanisms, not categories. Each answer must identify a specific assumption, actor, mechanism, precedent, or cost — not a class of risks.

1. The Inverting Assumption — one assumption, named precisely
2. The Missing Evidence — specific source, tradition, or data type
3. The Corruption Vector — structural feature already present (not hypothetical)
4. Who Benefits / Who Bears Cost — both named, distance described
5. The Historical Precedent — specific historical case
6. The Externalized Cost — specific cost, who pays it
7. Misuse Potential — specific use case for a bad actor

Run Gate 3 check: every answer must name a mechanism, not a category.

Write the full SHADOW-OUTPUT to: $RUN_DIR/phase-3-output.md
PROMPT
}

build_phase4_prompt() {
  cat > "$RUN_DIR/prompt-phase4.txt" <<PROMPT
You are the Phase 4 Synthesiser and Scribe for a market intelligence run.

RESEARCH QUESTION: $QUESTION

Instructions are in: $LIBRARY/phase-4-synthesis.md
Phase outputs are in:
  $RUN_DIR/phase-1-output.md
  $RUN_DIR/phase-2-output.md
  $RUN_DIR/phase-3-output.md

Synthesiser pass:
- Map load-bearing convergence: findings confirmed by ≥3 traditions, marked [CONVERGENT — N traditions agree]
- Map productive divergence: where traditions produce genuinely different pictures — name the disagreement and what is at stake
- Integrate Shadow findings into the body — not in a sidebar

Scribe pass:
- Produce the standard intelligence report in the exact format specified in phase-4-synthesis.md
- Do not add sections, remove sections, or rename sections
- No summary verdict. No confidence percentages. No triage table.

Complete Gate 4 checklist before writing final output.

Write the final intelligence report to: $RUN_DIR/phase-4-output.md
PROMPT
}

build_quick_prompt() {
  cat > "$RUN_DIR/prompt-quick.txt" <<PROMPT
You are running a QUICK SCAN market intelligence run. This is an abbreviated analysis — NOT sufficient for Demiurge briefs or major investment decisions.

RESEARCH QUESTION: $QUESTION

Manifest is in: $LIBRARY/manifest.md
Standard output format is in: $LIBRARY/phase-4-synthesis.md (use as reference for section headings only)

Steps:
1. Search for 2-3 non-corporate sources using WebSearch and WebFetch (any two tradition clusters: academic, institutional, or heterodox)
2. Apply the 3 most relevant lenses from: Equilibrium, Dynamic, Complexity, Post-Keynesian, Ecological
3. Flag any immediate corruption vectors or structural concerns visible from the sources
4. Produce output using the same section headings as the standard report

Mark the entire output [QUICK SCAN] throughout. Include explicitly in the header:
  "Sources: N (below convergence threshold of 5) — findings unvalidated"

Write the quick scan output to: $RUN_DIR/phase-4-output.md
PROMPT
}

# ── Run ───────────────────────────────────────────────────────────────────────
if [[ "$QUICK" == "true" ]]; then
  build_quick_prompt
  run_phase "phase-4" "$RUN_DIR/prompt-quick.txt"
else
  build_phase1_prompt
  run_phase "phase-1" "$RUN_DIR/prompt-phase1.txt"

  build_phase2_prompt
  run_phase "phase-2" "$RUN_DIR/prompt-phase2.txt"

  build_phase3_prompt
  run_phase "phase-3" "$RUN_DIR/prompt-phase3.txt"

  build_phase4_prompt
  run_phase "phase-4" "$RUN_DIR/prompt-phase4.txt"
fi

echo "Run complete."
echo "Final report: $RUN_DIR/phase-4-output.md"
