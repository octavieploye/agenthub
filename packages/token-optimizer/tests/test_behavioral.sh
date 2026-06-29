#!/usr/bin/env bash
set -euo pipefail
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PACKAGE_DIR/token-audit.sh"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

TMPDIR=$(mktemp -d)
export TOKEN_OPT_PROJECT="$TMPDIR"
mkdir -p "$TMPDIR/.claude/skills/token-optimizer"
cp "$PACKAGE_DIR/criteria.md" "$TMPDIR/.claude/skills/token-optimizer/criteria.md"
cp "$PACKAGE_DIR/test-scenarios.md" "$TMPDIR/.claude/skills/token-optimizer/test-scenarios.md"

# Create minimal CLAUDE.md
mkdir -p "$TMPDIR/.claude"
echo "NEVER put source files in resources/bin/." > "$TMPDIR/.claude/CLAUDE.md"

# Skip all tests if no API key
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "SKIP: ANTHROPIC_API_KEY not set — behavioral gate tests require live API"
  rm -rf "$TMPDIR"
  exit 0
fi

# Verify the API key works by making a minimal probe request
_PROBE=$(curl --http1.1 -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":5,"system":"ping","messages":[{"role":"user","content":"pong"}]}' 2>/dev/null)
if echo "$_PROBE" | grep -q '"authentication_error"\|"invalid x-api-key"\|"error"'; then
  echo "SKIP: ANTHROPIC_API_KEY is set but not valid for REST API calls — behavioral gate tests require live API"
  rm -rf "$TMPDIR"
  exit 0
fi
unset _PROBE

# Test 1: --baseline creates baseline files
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --baseline 2>/dev/null
BASELINE_FILE="$TMPDIR/.token-audit-baselines/GENERIC-001.baseline.txt"
[[ -f "$BASELINE_FILE" ]] && pass "baseline created GENERIC-001" || fail "baseline missing GENERIC-001"

# Test 2: baseline file is non-empty
[[ -s "$BASELINE_FILE" ]] && pass "baseline file is non-empty" || fail "baseline file is empty"

# Test 3: --test with identical proposed instructions → PASS gate
mkdir -p "$TMPDIR/tmp/token-preview/.claude"
cp "$TMPDIR/.claude/CLAUDE.md" "$TMPDIR/tmp/token-preview/.claude/CLAUDE.md.proposed.md"
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --test 2>/dev/null
GATE="$TMPDIR/tmp/token-test-results/.gate-status"
[[ -f "$GATE" ]] && pass "test gate creates status file" || fail "test gate missing status file"

# Test 4: identical instructions produce PASS verdict
grep -q "PASS" "$GATE" && pass "identical instructions → PASS" || fail "identical instructions should PASS"

rm -rf "$TMPDIR"
echo "ALL BEHAVIORAL GATE TESTS PASSED"
