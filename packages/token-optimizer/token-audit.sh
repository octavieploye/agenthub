#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${TOKEN_OPT_PROJECT:-$(pwd)}"
CRITERIA="${PROJECT_ROOT}/.claude/skills/token-optimizer/criteria.md"
[[ ! -f "$CRITERIA" ]] && CRITERIA="${SCRIPT_DIR}/criteria.md"
source <(grep -E '^(CR_|QR_|CHARS_PER_TOKEN|TOKEN_OPT_MODEL)' "$CRITERIA")

STATE_FILE="${PROJECT_ROOT}/.token-audit-state"
BASELINES_DIR="${PROJECT_ROOT}/.token-audit-baselines"
PREVIEW_DIR="${PROJECT_ROOT}/tmp/token-preview"
TEST_RESULTS_DIR="${PROJECT_ROOT}/tmp/token-test-results"
AUDIT_LOG="${PROJECT_ROOT}/.claude/token-audit-log.md"
REPORT_DIR="${PROJECT_ROOT}/docs/token-reports"

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

call_claude() {
  local system="$1"
  local user="$2"
  local model="${TOKEN_OPT_MODEL:-claude-haiku-4-5-20251001}"
  if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "ERROR: ANTHROPIC_API_KEY not set" >&2
    exit 1
  fi
  curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: ${ANTHROPIC_API_VERSION:-2023-06-01}" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --arg model "$model" \
      --arg system "$system" \
      --arg user "$user" \
      '{model:$model,max_tokens:4096,system:$system,messages:[{role:"user",content:$user}]}')" \
  | jq -r '.content[0].text'
}

# ── Session-end mode ──────────────────────────────────────────────────────────
mode_session_end() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')
  local total_before=0 total_after=0

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

# ── Main dispatcher ───────────────────────────────────────────────────────────
MODE=""
for arg in "$@"; do
  case "$arg" in
    --mode=*)        MODE="${arg#--mode=}" ;;
    --count-tokens)  MODE="count-tokens" ;;
    --dry-run)       MODE="dry-run" ;;
    --judge)         MODE="judge" ;;
    --baseline)      MODE="baseline" ;;
    --test)          MODE="test" ;;
    --apply)         MODE="apply" ;;
  esac
done

# --count-tokens <file> helper (used by tests)
if [[ "$MODE" == "count-tokens" ]]; then
  count_tokens "${@: -1}"
  exit 0
fi

case "$MODE" in
  session-end)  mode_session_end ;;
  stuck-check)  echo "stub: stuck-check (Task 4)" ; exit 0 ;;
  full)         mode_session_end ;;
  dry-run)      echo "stub: dry-run (Task 3 follow-up)" ; exit 0 ;;
  judge)        echo "stub: judge (Task 5)" ; exit 0 ;;
  baseline)     echo "stub: baseline (Task 6)" ; exit 0 ;;
  test)         echo "stub: test (Task 6)" ; exit 0 ;;
  apply)        echo "stub: apply (Task 7)" ; exit 0 ;;
  *)            echo "Usage: token-audit.sh --mode=<stuck-check|session-end|full|dry-run|judge|baseline|test|apply>" ; exit 1 ;;
esac
