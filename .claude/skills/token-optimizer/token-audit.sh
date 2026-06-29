#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${TOKEN_OPT_PROJECT:-$(pwd)}"
CRITERIA="${PROJECT_ROOT}/.claude/skills/token-optimizer/criteria.md"
[[ ! -f "$CRITERIA" ]] && CRITERIA="${SCRIPT_DIR}/criteria.md"
source <(grep -E '^(CR_|QR_|CHARS_PER_TOKEN)' "$CRITERIA")

PREVIEW_DIR="${PROJECT_ROOT}/tmp/token-preview"
TEST_RESULTS_DIR="${PROJECT_ROOT}/tmp/token-test-results"
AUDIT_LOG="${PROJECT_ROOT}/.claude/token-audit-log.md"

# ── Helpers ──────────────────────────────────────────────────────────────────
count_tokens() {
  local file="$1"
  local chars
  chars=$(wc -c < "$file")
  echo $(( chars / ${CHARS_PER_TOKEN:-4} ))
}

find_llm_files() {
  find "$PROJECT_ROOT" \
    -name "*.md" \
    -not -path "*/human/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/tmp/*" \
    -not -path "*/docs/token-reports/*" \
    \( -path "*/.claude/*" -o -name "CLAUDE.md" -o -name "AGENT.md" \) \
    2>/dev/null
}

classify_file() {
  local file="$1"
  local content
  content=$(cat "$file")
  if echo "$content" | grep -qiE '(NEVER|ALWAYS|MUST NOT|DO NOT|NEVER USE)'; then
    echo "rules"
  elif echo "$content" | grep -qiE '(step [0-9]|^\s*[0-9]+\.|checklist|\- \[)'; then
    echo "workflow"
  elif [[ "$file" == */how-to/* ]] || [[ "$file" == */docs/* && "$file" != */.claude/* ]]; then
    echo "human"
  else
    echo "context"
  fi
}

cr_target_for_class() {
  case "$1" in
    rules)    echo "${CR_RULES:-1.5}" ;;
    context)  echo "${CR_CONTEXT:-1.5}" ;;
    workflow) echo "${CR_WORKFLOW:-1.5}" ;;
    human)    echo "1.0" ;;
  esac
}

# ── Dry-run mode (scan only — no LLM) ────────────────────────────────────────
# Shows token counts and CR targets. The running agent reads each file and
# writes proposed versions to tmp/token-preview/<rel>.proposed.md.
mode_dry_run() {
  echo "=== TOKEN SCAN ==="
  echo ""
  local total=0
  while IFS= read -r file; do
    local class cr_target tokens rel
    class=$(classify_file "$file")
    [[ "$class" == "human" ]] && continue
    cr_target=$(cr_target_for_class "$class")
    tokens=$(count_tokens "$file")
    rel="${file#$PROJECT_ROOT/}"
    total=$((total + tokens))
    echo "[$class] $rel"
    echo "  Tokens: $tokens | CR target: ${cr_target}x | Goal: $(awk "BEGIN {printf \"%d\", $tokens / $cr_target}") tokens"
    echo ""
  done < <(find_llm_files)
  echo "Total LLM-directed tokens: $total"
  echo ""
  echo "Next steps (agent-driven):"
  echo "  1. Read each file above and rewrite it to the CR target"
  echo "  2. Save each proposed version to: $PREVIEW_DIR/<rel>.proposed.md"
  echo "  3. Judge intent preservation: run --mode=set-gate --gate=judge --verdict=PASS"
  echo "  4. Run behavioral scenarios from test-scenarios.md manually"
  echo "  5. If all pass: run --mode=set-gate --gate=test --verdict=PASS"
  echo "  6. Run --apply to archive originals and write optimized versions"
}

# ── Set-gate mode ─────────────────────────────────────────────────────────────
# Agent calls this after doing its own analysis to mark a gate PASS or FAIL.
# Usage: token-audit.sh --mode=set-gate --gate=judge --verdict=PASS
mode_set_gate() {
  if [[ -z "${GATE_NAME:-}" || -z "${GATE_VERDICT:-}" ]]; then
    echo "Usage: token-audit.sh --mode=set-gate --gate=<judge|test> --verdict=<PASS|FAIL>"
    exit 1
  fi
  if [[ ! "${GATE_VERDICT}" =~ ^(PASS|FAIL)$ ]]; then
    echo "ERROR: --verdict must be PASS or FAIL, got: ${GATE_VERDICT}"
    exit 1
  fi
  case "${GATE_NAME}" in
    judge)
      mkdir -p "$PREVIEW_DIR"
      echo "${GATE_VERDICT}" > "$PREVIEW_DIR/.judge-gate-status"
      echo "Judge gate set: ${GATE_VERDICT}"
      ;;
    test)
      mkdir -p "$TEST_RESULTS_DIR"
      echo "${GATE_VERDICT}" > "$TEST_RESULTS_DIR/.gate-status"
      echo "Test gate set: ${GATE_VERDICT}"
      ;;
    *)
      echo "ERROR: unknown gate '${GATE_NAME}'. Valid: judge, test"
      exit 1
      ;;
  esac
}

# ── Session-end mode ──────────────────────────────────────────────────────────
mode_session_end() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')
  local total_before=0

  mkdir -p "$(dirname "$AUDIT_LOG")"

  {
    echo ""
    echo "## Session Audit — $timestamp"
    echo ""
    echo "| File | Tokens | Class |"
    echo "|---|---|---|"
  } >> "$AUDIT_LOG"

  while IFS= read -r file; do
    local tokens class
    tokens=$(count_tokens "$file")
    class=$(classify_file "$file")
    rel="${file#$PROJECT_ROOT/}"
    echo "| $rel | $tokens | $class |" >> "$AUDIT_LOG"
    total_before=$((total_before + tokens))
  done < <(find_llm_files)

  echo "" >> "$AUDIT_LOG"
  echo "**Total LLM-directed tokens: $total_before**" >> "$AUDIT_LOG"
  echo "Session-end audit complete. Log: $AUDIT_LOG"
}

# ── Apply mode ────────────────────────────────────────────────────────────────
mode_apply() {
  local judge_status_file="$PREVIEW_DIR/.judge-gate-status"
  local test_status_file="$TEST_RESULTS_DIR/.gate-status"

  local judge_ok=false test_ok=false
  [[ -f "$judge_status_file" ]] && grep -q "^PASS$" "$judge_status_file" && judge_ok=true
  [[ -f "$test_status_file" ]] && grep -q "^PASS$" "$test_status_file" && test_ok=true

  if [[ "$judge_ok" == "false" || "$test_ok" == "false" ]]; then
    echo "BLOCKED: --apply requires both gates to PASS."
    [[ "$judge_ok" == "false" ]] && echo "  Run --mode=set-gate --gate=judge --verdict=PASS after reviewing proposed files"
    [[ "$test_ok" == "false" ]] && echo "  Run --mode=set-gate --gate=test --verdict=PASS after validating scenarios"
    exit 1
  fi

  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')
  mkdir -p "$(dirname "$AUDIT_LOG")"

  while IFS= read -r file; do
    local class rel proposed_file human_dest
    class=$(classify_file "$file")
    [[ "$class" == "human" ]] && continue
    rel="${file#$PROJECT_ROOT/}"
    proposed_file="$PREVIEW_DIR/${rel}.proposed.md"
    [[ ! -f "$proposed_file" ]] && continue

    # Archive original to human/
    human_dest="$PROJECT_ROOT/human/$rel"
    mkdir -p "$(dirname "$human_dest")"
    cp "$file" "$human_dest"
    # Add header to archived version (POSIX-compatible temp-file pattern)
    local header="# [HUMAN VERSION] Agent version: $rel | Last optimized: $(date '+%Y-%m-%d')"
    { echo "$header"; echo ""; cat "$human_dest"; } > "${human_dest}.tmp" && mv "${human_dest}.tmp" "$human_dest"

    # Write optimized version in place
    cp "$proposed_file" "$file"

    # Log
    local before after
    before=$(count_tokens "$human_dest")
    after=$(count_tokens "$file")
    echo "- $rel | $before → $after tokens | applied $timestamp" >> "$AUDIT_LOG"
    echo "Applied: $rel ($before → $after tokens)"
  done < <(find_llm_files)

  echo ""
  echo "APPLY COMPLETE. Originals archived to human/. Review with: cat $AUDIT_LOG"
}

# ── Main dispatcher ───────────────────────────────────────────────────────────
MODE=""
GATE_NAME=""
GATE_VERDICT=""

for arg in "$@"; do
  case "$arg" in
    --mode=*)    MODE="${arg#--mode=}" ;;
    --count-tokens) MODE="count-tokens" ;;
    --dry-run)   MODE="dry-run" ;;
    --apply)     MODE="apply" ;;
    --gate=*)    GATE_NAME="${arg#--gate=}" ;;
    --verdict=*) GATE_VERDICT="${arg#--verdict=}" ;;
  esac
done

# --count-tokens <file> helper (used by tests)
if [[ "$MODE" == "count-tokens" ]]; then
  count_tokens "${@: -1}"
  exit 0
fi

case "$MODE" in
  session-end)  mode_session_end ;;
  full)         mode_session_end ;;
  dry-run)      mode_dry_run ;;
  set-gate)     mode_set_gate ;;
  apply)        mode_apply ;;
  *)            echo "Usage: token-audit.sh --mode=<session-end|dry-run|set-gate|apply>" ; exit 1 ;;
esac
