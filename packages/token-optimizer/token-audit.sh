#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${TOKEN_OPT_PROJECT:-$(pwd)}"
CRITERIA="${PROJECT_ROOT}/.claude/skills/token-optimizer/criteria.md"
[[ ! -f "$CRITERIA" ]] && CRITERIA="${SCRIPT_DIR}/criteria.md"
source <(grep -E '^(CR_|QR_|CHARS_PER_TOKEN|MAX_AUDIT_SESSIONS|DEFAULT_PROFILE)' "$CRITERIA")

PREVIEW_DIR="${PROJECT_ROOT}/tmp/token-preview"
TEST_RESULTS_DIR="${PROJECT_ROOT}/tmp/token-test-results"
AUDIT_LOG="${PROJECT_ROOT}/.claude/token-audit-log.md"
PROFILES_DIR="${SCRIPT_DIR}/profiles"

# ── Profile loading ──────────────────────────────────────────────────────────
load_profile() {
  local profile="${1:-${DEFAULT_PROFILE:-coding}}"
  local profile_file="${PROFILES_DIR}/${profile}.conf"
  if [[ -f "$profile_file" ]]; then
    source <(grep -E '^(CR_|QR_FLOOR_)' "$profile_file")
    echo "Profile loaded: $profile"
  else
    echo "Profile not found: $profile (using defaults from criteria.md)"
  fi
}

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
    -not -path "*/current-system-countercheck/*" \
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

# ── Log rotation ─────────────────────────────────────────────────────────────
rotate_audit_log() {
  local max_sessions="${MAX_AUDIT_SESSIONS:-5}"
  [[ ! -f "$AUDIT_LOG" ]] && return 0

  local session_count
  session_count=$(grep -c "^## Session Audit" "$AUDIT_LOG" 2>/dev/null || echo 0)

  if (( session_count > max_sessions )); then
    local skip=$(( session_count - max_sessions ))
    local keep_from
    keep_from=$(grep -n "^## Session Audit" "$AUDIT_LOG" | sed -n "$((skip + 1))p" | cut -d: -f1)

    if [[ -n "$keep_from" ]]; then
      local rotated="${AUDIT_LOG%.md}-rotated-$(date '+%Y%m%d').md"
      head -n $((keep_from - 1)) "$AUDIT_LOG" > "$rotated"
      tail -n +"$keep_from" "$AUDIT_LOG" > "${AUDIT_LOG}.tmp" && mv "${AUDIT_LOG}.tmp" "$AUDIT_LOG"
      echo "Log rotated: kept last $max_sessions sessions, archived $skip old sessions"
    fi
  fi
}

# ── Dry-run mode (scan only — no LLM) ────────────────────────────────────────
mode_dry_run() {
  echo "=== TOKEN SCAN ==="
  [[ -n "${ACTIVE_PROFILE:-}" ]] && echo "Profile: $ACTIVE_PROFILE"
  echo ""
  local total=0
  local file_count=0
  while IFS= read -r file; do
    local class cr_target tokens rel
    class=$(classify_file "$file")
    [[ "$class" == "human" ]] && continue
    cr_target=$(cr_target_for_class "$class")
    tokens=$(count_tokens "$file")
    rel="${file#$PROJECT_ROOT/}"
    total=$((total + tokens))
    file_count=$((file_count + 1))
    echo "[$class] $rel"
    local goal
    goal=$(python3 -c "print(int($tokens / $cr_target))" 2>/dev/null || echo "?")
    echo "  Tokens: $tokens | CR target: ${cr_target}x | Goal: $goal tokens"
    echo ""
  done < <(find_llm_files)
  echo "Total LLM-directed tokens: $total ($file_count files)"
  echo ""
  echo "Next steps (agent-driven):"
  echo "  1. Read each file above and rewrite it to the CR target"
  echo "  2. Save each proposed version to: $PREVIEW_DIR/<rel>.proposed.md"
  echo "  3. Judge intent preservation: run --mode=set-gate --gate=judge --verdict=PASS"
  echo "  4. Run behavioral scenarios from test-scenarios.md"
  echo "  5. If all pass: run --mode=set-gate --gate=test --verdict=PASS"
  echo "  6. Run --apply to archive originals and write optimized versions"
}

# ── Set-gate mode ─────────────────────────────────────────────────────────────
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
  local file_count=0

  mkdir -p "$(dirname "$AUDIT_LOG")"

  # Rotate before appending
  rotate_audit_log

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
    file_count=$((file_count + 1))
  done < <(find_llm_files)

  echo "" >> "$AUDIT_LOG"
  echo "**Total LLM-directed tokens: $total_before ($file_count files)**" >> "$AUDIT_LOG"
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

# ── Status mode ───────────────────────────────────────────────────────────────
mode_status() {
  echo "=== TOKEN OPTIMIZER STATUS ==="
  echo ""

  # Last audit
  if [[ -f "$AUDIT_LOG" ]]; then
    local last_session
    last_session=$(grep "^## Session Audit" "$AUDIT_LOG" | tail -1)
    local last_total
    last_total=$(grep "Total LLM-directed tokens" "$AUDIT_LOG" | tail -1)
    echo "Last audit: ${last_session#\#\# }"
    echo "$last_total"
  else
    echo "No audit log found. Run --dry-run to start."
  fi
  echo ""

  # Gate status
  local judge_status="NOT SET"
  local test_status="NOT SET"
  [[ -f "$PREVIEW_DIR/.judge-gate-status" ]] && judge_status=$(cat "$PREVIEW_DIR/.judge-gate-status")
  [[ -f "$TEST_RESULTS_DIR/.gate-status" ]] && test_status=$(cat "$TEST_RESULTS_DIR/.gate-status")
  echo "Gate 3 (Judge): $judge_status"
  echo "Gate 4 (Test):  $test_status"
  echo ""

  # Pending proposed files
  if [[ -d "$PREVIEW_DIR" ]]; then
    local proposed_count
    proposed_count=$(find "$PREVIEW_DIR" -name "*.proposed.md" 2>/dev/null | wc -l | tr -d ' ')
    echo "Proposed rewrites pending: $proposed_count"
  else
    echo "No proposed rewrites."
  fi

  # Available profiles
  echo ""
  echo "Available profiles:"
  if [[ -d "$PROFILES_DIR" ]]; then
    for pf in "$PROFILES_DIR"/*.conf; do
      [[ -f "$pf" ]] && echo "  - $(basename "$pf" .conf)"
    done
  else
    echo "  (none — using defaults)"
  fi
}

# ── Main dispatcher ───────────────────────────────────────────────────────────
MODE=""
GATE_NAME=""
GATE_VERDICT=""
ACTIVE_PROFILE=""

for arg in "$@"; do
  case "$arg" in
    --mode=*)     MODE="${arg#--mode=}" ;;
    --count-tokens) MODE="count-tokens" ;;
    --dry-run)    MODE="dry-run" ;;
    --apply)      MODE="apply" ;;
    --status)     MODE="status" ;;
    --gate=*)     GATE_NAME="${arg#--gate=}" ;;
    --verdict=*)  GATE_VERDICT="${arg#--verdict=}" ;;
    --profile=*)  ACTIVE_PROFILE="${arg#--profile=}" ;;
  esac
done

# Load profile if specified
[[ -n "$ACTIVE_PROFILE" ]] && load_profile "$ACTIVE_PROFILE"

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
  status)       mode_status ;;
  *)            echo "Usage: token-audit.sh --mode=<session-end|dry-run|set-gate|apply|status> [--profile=<name>]" ; exit 1 ;;
esac
