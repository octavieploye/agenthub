#!/usr/bin/env zsh
# market-sim-run.sh — Market Intelligence Pre-Simulation Workflow
# Runs all 6 phases: Business Research → Data Analysis → Statistical Validation
#                  → Pre-Offer Intelligence → [source] → Market Simulation
#
# Usage:
#   ./market-sim-run.sh                              # fill brief in editor
#   ./market-sim-run.sh --brief brief.md             # brief from file
#   ./market-sim-run.sh --brief brief.md myproduct   # named run directory
#   ./market-sim-run.sh --from 3 --run-dir .market-sim-runs/20260629-1400-myproduct

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
WORKFLOW_LIB="$SCRIPT_DIR/.claude/market-sim-prep"
RUNS_DIR="$SCRIPT_DIR/.market-sim-runs"

log()    { print -P "%F{green}[market-sim]%f $*" }
warn()   { print -P "%F{yellow}[warn]%f $*" }
err()    { print -P "%F{red}[error]%f $*"; exit 1 }
header() { print -P "\n%B%F{cyan}══════════════════════════════════════%f%b"
           print -P "%B%F{cyan}  $*%f%b"
           print -P "%B%F{cyan}══════════════════════════════════════%f%b\n" }

[[ -d "$WORKFLOW_LIB" ]] || err "Workflow files not found at: $WORKFLOW_LIB"

BRIEF_FILE=""
FROM_PHASE=1
PRODUCT_NAME="run"
RUN_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --brief)   BRIEF_FILE="$2";   shift 2 ;;
    --from)    FROM_PHASE="$2";   shift 2 ;;
    --run-dir) RUN_DIR="$2";      shift 2 ;;
    --help|-h) grep '^#' "$0" | sed 's/^# \?//'; exit 0 ;;
    -*)        err "Unknown option: $1" ;;
    *)         PRODUCT_NAME="$1"; shift ;;
  esac
done

if [[ -z "$RUN_DIR" ]]; then
  TIMESTAMP=$(date +%Y%m%d-%H%M)
  RUN_DIR="$RUNS_DIR/${TIMESTAMP}-${PRODUCT_NAME}"
fi
mkdir -p "$RUN_DIR"
log "Run directory: $RUN_DIR"

INPUT_BRIEF_PATH="$RUN_DIR/input-brief.md"

if [[ -f "$INPUT_BRIEF_PATH" ]]; then
  log "Using existing brief: $INPUT_BRIEF_PATH"
elif [[ -n "$BRIEF_FILE" ]]; then
  cp "$BRIEF_FILE" "$INPUT_BRIEF_PATH"
  log "Brief loaded from: $BRIEF_FILE"
else
  cat > "$INPUT_BRIEF_PATH" << 'BRIEF_TEMPLATE'
WORKFLOW INPUT BRIEF
====================
Product/Service:
Market territories:    [FR / EU / US / GLOBAL / or specific countries]
Known audiences:
Known competitors:
Primary question:
Secondary questions:
Time constraint:
Prior research:
BRIEF_TEMPLATE
  log "INPUT BRIEF template created at: $INPUT_BRIEF_PATH"
  log "Fill it in, save, close the editor to continue."
  ${EDITOR:-nano} "$INPUT_BRIEF_PATH"
  print -n "Brief complete — press ENTER to launch: "
  read -r
fi

BRIEF=$(cat "$INPUT_BRIEF_PATH")
phase_out() { echo "$RUN_DIR/phase-${1}-output.md" }

run_phase() {
  local num="$1" name="$2" phase_file="$3" prev_num="${4:-}"
  local out; out=$(phase_out "$num")

  header "PHASE ${num}: ${name}"

  local prompt_file; prompt_file=$(mktemp /tmp/market-sim-p${num}-XXXXXX.txt)
  trap "rm -f '$prompt_file'" EXIT INT TERM

  {
    echo "# MARKET INTELLIGENCE WORKFLOW — PHASE ${num}: ${name}"
    echo ""; echo "## WORKFLOW MANIFEST"
    cat "$WORKFLOW_LIB/manifest.md"
    echo ""; echo "## INPUT BRIEF"
    echo "$BRIEF"
    if [[ -n "$prev_num" ]]; then
      local prev_out; prev_out=$(phase_out "$prev_num")
      [[ -f "$prev_out" ]] || err "Phase ${prev_num} output not found: $prev_out"
      echo ""; echo "## PREVIOUS PHASE OUTPUT (Phase ${prev_num})"
      cat "$prev_out"
    fi
    echo ""; echo "## PHASE ${num} INSTRUCTIONS — FOLLOW EXACTLY"
    cat "$phase_file"
    echo ""; echo "## HANDOFF PROTOCOLS (gate checklists)"
    cat "$WORKFLOW_LIB/handoffs.md"
    echo ""; echo "---"
    echo "EXECUTE Phase ${num} (${name}) exactly as specified."
    echo "Complete every step. Run the Gate ${num} checklist before closing."
  } > "$prompt_file"

  claude --print \
    --permission-mode bypassPermissions \
    --allowed-tools "WebSearch,Read,Write,Bash" \
    --add-dir "$SCRIPT_DIR" \
    < "$prompt_file" \
    > "$out"

  [[ -s "$out" ]] || err "Phase ${num} produced no output."
  log "Phase ${num} complete → $out"
}

[[ $FROM_PHASE -le 1 ]] && run_phase 1 "Business Research + Geo Psychology" \
  "$WORKFLOW_LIB/phase-1-business-research.md"

[[ $FROM_PHASE -le 2 ]] && run_phase 2 "Data Analysis" \
  "$WORKFLOW_LIB/phase-2-data-analysis.md" "1"

[[ $FROM_PHASE -le 3 ]] && run_phase 3 "Statistical Validation" \
  "$WORKFLOW_LIB/phase-3-stats-validation.md" "2"

[[ $FROM_PHASE -le 4 ]] && run_phase 4 "Pre-Offer Intelligence" \
  "$WORKFLOW_LIB/phase-4-simulation-criteria.md" "3"

if [[ $FROM_PHASE -le 5 ]]; then
  header "PHASE 5: [source] Offer Engineering"
  local [source]_prompt; [source]_prompt=$(mktemp /tmp/market-sim-[source]-XXXXXX.txt)
  trap "rm -f '$[source]_prompt'" EXIT INT TERM
  {
    echo "# STRATEGY OFFER ENGINEERING — PHASE 5"
    echo ""; echo "## STRATEGY INPUT CONTRACT"
    cat "$WORKFLOW_LIB/handoffs.md"
    echo ""; echo "## PRE-OFFER INTELLIGENCE (Phase 4)"
    cat "$(phase_out 4)"
    echo ""; echo "## PERSONAS + GEO PSYCHOLOGY (Phase 1)"
    cat "$(phase_out 1)"
    echo ""; echo "## STATISTICAL BENCHMARKS (Phase 3)"
    cat "$(phase_out 3)"
    echo ""; echo "---"
    echo "Run [source] agents in sequence: Market Position → Offer Architect → Acquisition Analyst → Unit Economics → Monetization Architect."
    echo "Ground every output in the Phase 4 intelligence — not raw assumptions."
    echo "Produce: offer-tiers, acquisition-map, unit-economics, market-position, monetization-model, [source]-notes."
  } > "$[source]_prompt"
  claude --print \
    --permission-mode bypassPermissions \
    --allowed-tools "Read,Write" \
    --add-dir "$SCRIPT_DIR" \
    < "$[source]_prompt" > "$(phase_out 5)"
  log "Phase 5 complete → $(phase_out 5)"
fi

if [[ $FROM_PHASE -le 6 ]]; then
  header "PHASE 6: Market Simulation"
  local sim_prompt; sim_prompt=$(mktemp /tmp/market-sim-p6-XXXXXX.txt)
  trap "rm -f '$sim_prompt'" EXIT INT TERM
  {
    echo "# MARKET SIMULATION — PHASE 6"
    echo ""; echo "## SIMULATION INSTRUCTIONS"
    cat "$WORKFLOW_LIB/phase-6-simulation.md"
    echo ""; echo "## SIMULATION INPUT CONTRACT"
    cat "$WORKFLOW_LIB/handoffs.md"
    echo ""; echo "## STRATEGY OFFER (Phase 5 — what you are testing)"
    cat "$(phase_out 5)"
    echo ""; echo "## GEO BUYING PSYCHOLOGY + PERSONAS (Phase 1)"
    cat "$(phase_out 1)"
    echo ""; echo "## STATISTICAL VALIDATION (Phase 3)"
    cat "$(phase_out 3)"
    echo ""; echo "---"
    echo "Build 5–10 scenario cards. Each: specific persona + country + pricing tier + market trend + recent event + economic situation + emotional trigger."
    echo "Required: 1 EU-frame, 1 US-frame, 1 non-Western, 1 constrained-budget, 1 with P(convert) below 30%."
    echo "Complete cross-scenario synthesis (all 5 sections) and sequencing recommendation."
    echo "Run Gate 6 checklist before producing SIMULATION-OUTPUT."
  } > "$sim_prompt"
  claude --print \
    --permission-mode bypassPermissions \
    --allowed-tools "Read,Write" \
    --add-dir "$SCRIPT_DIR" \
    < "$sim_prompt" > "$(phase_out 6)"
  log "Phase 6 complete → $(phase_out 6)"
fi

header "WORKFLOW COMPLETE"
echo "  Run directory: $RUN_DIR"
echo ""
echo "  Phase 1 — Business Research + Geo Psychology  → $(phase_out 1)"
echo "  Phase 2 — Data Analysis                       → $(phase_out 2)"
echo "  Phase 3 — Statistical Validation              → $(phase_out 3)"
echo "  Phase 4 — Pre-Offer Intelligence              → $(phase_out 4)"
echo "  Phase 5 — [source] Offer Engineering           → $(phase_out 5)"
echo "  Phase 6 — Market Simulation (5–10 scenarios)  → $(phase_out 6)"
echo ""
log "Review Phase 6 SIMULATION-OUTPUT and confirm launch sequence."
