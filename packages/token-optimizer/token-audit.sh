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
  curl --http1.1 -s https://api.anthropic.com/v1/messages \
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

# ── Dry-run mode ─────────────────────────────────────────────────────────────
mode_dry_run() {
  mkdir -p "$PREVIEW_DIR"
  echo "=== DRY-RUN PREVIEW ==="
  echo ""
  while IFS= read -r file; do
    local class cr_target tokens_before tokens_after rel proposed_dir proposed_file cr tes REWRITE_PROMPT
    class=$(classify_file "$file")
    [[ "$class" == "human" ]] && continue
    cr_target=$(cr_target_for_class "$class")
    tokens_before=$(count_tokens "$file")
    rel="${file#$PROJECT_ROOT/}"

    REWRITE_PROMPT="You are a token optimizer for AI instruction files.
Rewrite the following $class instruction content at a ${cr_target}x compression ratio.
Rules: preserve ALL behavioral directives exactly. Remove narrative prose, rationale, examples unless they change agent behavior. Use imperative sentences. No markdown headers unless structurally necessary.
Output ONLY the rewritten content, no preamble.

CONTENT:
$(cat "$file")"

    proposed_dir="$PREVIEW_DIR/$(dirname "$rel")"
    proposed_file="$PREVIEW_DIR/${rel}.proposed.md"
    mkdir -p "$proposed_dir"

    call_claude "You are a token-efficiency expert." "$REWRITE_PROMPT" > "$proposed_file"
    tokens_after=$(count_tokens "$proposed_file")
    cr=$(awk "BEGIN {printf \"%.1f\", $tokens_before/$tokens_after}")
    tes=$(awk "BEGIN {printf \"%.2f\", $cr * 0.98}")  # assume QR=0.98 for preview

    echo "[$class] $rel"
    echo "  Before: $tokens_before tokens | After: $tokens_after tokens | CR: ${cr}x | TES: $tes"
    echo "  Preview: $proposed_file"
    echo ""
  done < <(find_llm_files)
  echo "Review previews in: $PREVIEW_DIR"
  echo "Next: run --judge to score intent preservation"
}

# ── Judge mode ────────────────────────────────────────────────────────────────
mode_judge() {
  local all_pass=true
  while IFS= read -r file; do
    local class rel proposed_file judge_file result verdict JUDGE_PROMPT
    class=$(classify_file "$file")
    [[ "$class" == "human" ]] && continue
    rel="${file#$PROJECT_ROOT/}"
    proposed_file="$PREVIEW_DIR/${rel}.proposed.md"
    judge_file="$PREVIEW_DIR/${rel}.judge.txt"

    [[ ! -f "$proposed_file" ]] && {
      echo "SKIP: $rel — no preview found. Run --dry-run first."
      continue
    }

    JUDGE_PROMPT="Compare these two AI instruction texts.
ORIGINAL:
$(cat "$file")

PROPOSED (compressed):
$(cat "$proposed_file")

Evaluate: does the PROPOSED version preserve all behavioral directives from the ORIGINAL?
- PASS: all rules, constraints, and behavioral requirements are preserved
- PARTIAL: minor loss of nuance but core behavior preserved
- FAIL: one or more behavioral directives are missing or weakened

Respond with exactly one line: PASS, PARTIAL, or FAIL
Then a blank line.
Then a brief explanation (max 3 sentences)."

    result=$(call_claude "You are an AI instruction quality auditor." "$JUDGE_PROMPT")
    verdict=$(echo "$result" | head -1 | tr -d '[:space:]')
    mkdir -p "$(dirname "$judge_file")"
    echo "$verdict" > "$judge_file"
    echo "$result" | tail -n +3 >> "$judge_file"

    echo "[$verdict] $rel"
    [[ "$verdict" == "FAIL" || "$verdict" == "PARTIAL" ]] && all_pass=false
  done < <(find_llm_files)

  if [[ "$all_pass" == "true" ]]; then
    echo ""
    echo "JUDGE GATE: PASS — all files scored PASS"
    echo "Next: run --baseline (first time) then --test"
  else
    echo ""
    echo "JUDGE GATE: FAIL — one or more files scored PARTIAL or FAIL"
    echo "Adjust compression ratio in criteria.md and re-run --dry-run"
    exit 1
  fi
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

# ── Baseline mode ────────────────────────────────────────────────────────────
mode_baseline() {
  mkdir -p "$BASELINES_DIR"
  local scenarios_file="$PROJECT_ROOT/.claude/skills/token-optimizer/test-scenarios.md"
  [[ ! -f "$scenarios_file" ]] && scenarios_file="${SCRIPT_DIR}/test-scenarios.md"

  # Build combined system prompt from all LLM-directed files
  local sys_prompt=""
  while IFS= read -r file; do
    sys_prompt+="$(cat "$file")"$'\n\n'
  done < <(find_llm_files)

  # Extract scenarios and capture baselines
  local scenario_id="" scenario_prompt="" scenario_check=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^##\ (GENERIC|PROJ)-[0-9]+ ]]; then
      [[ -n "$scenario_id" && -n "$scenario_prompt" ]] && {
        local resp
        resp=$(call_claude "$sys_prompt" "$scenario_prompt")
        echo "$resp" > "$BASELINES_DIR/${scenario_id}.baseline.txt"
        echo "$scenario_check" > "$BASELINES_DIR/${scenario_id}.check.txt"
        echo "$scenario_prompt" > "$BASELINES_DIR/${scenario_id}.prompt.txt"
        echo "Captured baseline: $scenario_id"
      }
      scenario_id=$(echo "$line" | grep -oE '(GENERIC|PROJ)-[0-9]+')
      scenario_prompt="" scenario_check=""
    elif [[ "$line" =~ ^Prompt:\ (.*) ]]; then
      scenario_prompt="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ^Compliance\ check:\ (.*) ]]; then
      scenario_check="${BASH_REMATCH[1]}"
    fi
  done < "$scenarios_file"
  # Capture last scenario
  [[ -n "$scenario_id" && -n "$scenario_prompt" ]] && {
    local resp
    resp=$(call_claude "$sys_prompt" "$scenario_prompt")
    echo "$resp" > "$BASELINES_DIR/${scenario_id}.baseline.txt"
    echo "$scenario_check" > "$BASELINES_DIR/${scenario_id}.check.txt"
    echo "$scenario_prompt" > "$BASELINES_DIR/${scenario_id}.prompt.txt"
    echo "Captured baseline: $scenario_id"
  }
  echo "Baseline captured. Run --test after --dry-run + --judge PASS."
}

# ── Test mode ─────────────────────────────────────────────────────────────────
mode_test() {
  local timestamp run_dir all_pass=true
  timestamp=$(date '+%Y-%m-%d-%H-%M')
  run_dir="$TEST_RESULTS_DIR/$timestamp"
  mkdir -p "$run_dir"

  # Build system prompt from PROPOSED files (fall back to original if no proposed)
  local sys_prompt=""
  while IFS= read -r file; do
    local rel proposed_file
    rel="${file#$PROJECT_ROOT/}"
    proposed_file="$PREVIEW_DIR/${rel}.proposed.md"
    if [[ -f "$proposed_file" ]]; then
      sys_prompt+="$(cat "$proposed_file")"$'\n\n'
    else
      sys_prompt+="$(cat "$file")"$'\n\n'
    fi
  done < <(find_llm_files)

  for baseline_file in "$BASELINES_DIR"/*.baseline.txt; do
    [[ -f "$baseline_file" ]] || continue
    local scenario_id check_file check baseline_resp proposed_resp verdict
    scenario_id=$(basename "$baseline_file" .baseline.txt)
    check_file="$BASELINES_DIR/${scenario_id}.check.txt"
    check=$(cat "$check_file" 2>/dev/null || echo "response is consistent with original")
    baseline_resp=$(cat "$baseline_file")

    local prompt_file user_prompt
    prompt_file="$BASELINES_DIR/${scenario_id}.prompt.txt"
    [[ ! -f "$prompt_file" ]] && { echo "SKIP: $scenario_id — no prompt file"; continue; }
    user_prompt=$(cat "$prompt_file")

    proposed_resp=$(call_claude "$sys_prompt" "$user_prompt")

    local COMPARE_PROMPT
    COMPARE_PROMPT="BASELINE response (original instructions):
$baseline_resp

PROPOSED response (optimized instructions):
$proposed_resp

Compliance check required: $check

Does the PROPOSED response comply with the same check as BASELINE?
Answer: COMPLIANT or REGRESSION (one word only, first line)"

    verdict=$(call_claude "You are a behavioral compliance auditor." "$COMPARE_PROMPT" | head -1 | tr -d '[:space:]')
    echo "$verdict — $scenario_id" | tee "$run_dir/${scenario_id}.result.txt"
    [[ "$verdict" != "COMPLIANT" ]] && all_pass=false
  done

  local gate_status="PASS"
  [[ "$all_pass" == "false" ]] && gate_status="FAIL"
  echo "$gate_status" > "$TEST_RESULTS_DIR/.gate-status"
  echo ""
  echo "BEHAVIORAL TEST GATE: $gate_status"
  [[ "$gate_status" == "FAIL" ]] && {
    echo "One or more scenarios showed REGRESSION. Increase CR conservatively and re-run from --dry-run."
    exit 1
  }
  echo "Next: run --apply to write changes"
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
  stuck-check)
    # Read existing window before appending (use POSIX-compatible loop for bash 3.2)
    WINDOW=()
    if [[ -f "$STATE_FILE" ]]; then
      while IFS= read -r line; do
        WINDOW+=("$line")
      done < "$STATE_FILE"
    fi
    N="${#WINDOW[@]}"

    if [[ "$N" -gt 0 ]]; then
      # Condition 1: 3+ consecutive same tool (no intervening write)
      LAST_TOOL=$(echo "${WINDOW[$((N-1))]}" | cut -d'|' -f2)
      CONSECUTIVE=1
      for (( i=N-2; i>=0; i-- )); do
        ENTRY="${WINDOW[$i]}"
        W=$(echo "$ENTRY" | cut -d'|' -f3)
        T=$(echo "$ENTRY" | cut -d'|' -f2)
        [[ "$W" == "1" ]] && break
        [[ "$T" == "$LAST_TOOL" ]] && CONSECUTIVE=$((CONSECUTIVE+1)) || break
      done
      if [[ "$CONSECUTIVE" -ge 3 ]]; then
        echo "TOKEN-OPT: Agent may be stuck — $CONSECUTIVE consecutive $LAST_TOOL calls with no output. Consider invoking token-optimizer skill." >&2
        exit 1
      fi

      # Condition 2: 5+ calls since last write
      CALLS_SINCE_WRITE=0
      for (( i=N-1; i>=0; i-- )); do
        W=$(echo "${WINDOW[$i]}" | cut -d'|' -f3)
        [[ "$W" == "1" ]] && break
        CALLS_SINCE_WRITE=$((CALLS_SINCE_WRITE+1))
      done
      if [[ "$CALLS_SINCE_WRITE" -ge 5 ]]; then
        echo "TOKEN-OPT: $CALLS_SINCE_WRITE tool calls since last file write. Agent may be stuck." >&2
        exit 1
      fi
    fi

    # Append current call to state
    TOOL="${TOOL_NAME:-Unknown}"
    HAD_WRITE=0
    [[ "$TOOL" =~ ^(Write|Edit|Bash)$ ]] && HAD_WRITE=1
    mkdir -p "$(dirname "$STATE_FILE")"
    echo "$(date +%s)|$TOOL|$HAD_WRITE" >> "$STATE_FILE"
    # Keep only last 10 entries
    tail -10 "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    exit 0
    ;;
  full)         mode_session_end ;;
  dry-run)      mode_dry_run ;;
  judge)        mode_judge ;;
  baseline)     mode_baseline ;;
  test)         mode_test ;;
  apply)        echo "stub: apply (Task 7)" ; exit 0 ;;
  *)            echo "Usage: token-audit.sh --mode=<stuck-check|session-end|full|dry-run|judge|baseline|test|apply>" ; exit 1 ;;
esac
