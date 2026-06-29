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

# Create a sample LLM-directed file
mkdir -p "$TMPDIR/.claude"
cat > "$TMPDIR/.claude/CLAUDE.md" << 'MDEOF'
# Rules
NEVER place source files in resources/bin/. That directory is for compiled binaries only.
NEVER change dependency versions without user approval.
Always run tests via npm test, never npx vitest directly.
MDEOF

# Skip all tests if no API key or if API key is not valid for REST calls
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "SKIP: ANTHROPIC_API_KEY not set — judge gate tests require live API"
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
  echo "SKIP: ANTHROPIC_API_KEY is set but not valid for REST API calls — judge gate tests require live API"
  rm -rf "$TMPDIR"
  exit 0
fi
unset _PROBE

# Test 1: --dry-run creates preview file
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --dry-run 2>/dev/null || true
PREVIEW="$TMPDIR/tmp/token-preview/.claude/CLAUDE.md.proposed.md"
[[ -f "$PREVIEW" ]] && pass "dry-run creates preview file" || fail "dry-run did not create $PREVIEW"

# Test 2: preview file is shorter than original (compressed)
ORIG_SIZE=$(wc -c < "$TMPDIR/.claude/CLAUDE.md")
PREV_SIZE=$(wc -c < "$PREVIEW")
[[ "$PREV_SIZE" -le "$ORIG_SIZE" ]] && pass "preview is <= original size" || fail "preview ($PREV_SIZE) > original ($ORIG_SIZE)"

# Test 3: --judge creates judge result file
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --judge 2>/dev/null || true
JUDGE="$TMPDIR/tmp/token-preview/.claude/CLAUDE.md.judge.txt"
[[ -f "$JUDGE" ]] && pass "judge creates result file" || fail "judge did not create $JUDGE"

# Test 4: judge result contains PASS, PARTIAL, or FAIL
grep -qE "^(PASS|PARTIAL|FAIL)$" "$JUDGE" \
  && pass "judge result is valid verdict" || fail "judge result does not start with PASS/PARTIAL/FAIL"

rm -rf "$TMPDIR"
echo "ALL JUDGE GATE TESTS PASSED"
