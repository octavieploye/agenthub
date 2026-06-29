#!/usr/bin/env bash
set -euo pipefail
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PACKAGE_DIR/token-audit.sh"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# Test 1: script is executable
[[ -x "$SCRIPT" ]] && pass "token-audit.sh is executable" || fail "token-audit.sh not executable"

# Test 2: token count function produces a number
TMPFILE=$(mktemp)
printf "%.0s%s" {1..100} "hello world " > "$TMPFILE"
COUNT=$(bash "$SCRIPT" --count-tokens "$TMPFILE")
[[ "$COUNT" =~ ^[0-9]+$ ]] && pass "token count is numeric: $COUNT" || fail "token count not numeric: $COUNT"
rm "$TMPFILE"

# Test 3: 1200-char file → ~300 tokens
TMPFILE=$(mktemp)
python3 -c "print('a' * 1200)" > "$TMPFILE"
COUNT=$(bash "$SCRIPT" --count-tokens "$TMPFILE")
[[ "$COUNT" -eq 300 ]] && pass "1200 chars = 300 tokens" || fail "expected 300, got $COUNT"
rm "$TMPFILE"

# Test 4: --mode=session-end exits 0
TMPDIR=$(mktemp -d)
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --mode=session-end \
  && pass "session-end exits 0" || fail "session-end failed"
rm -rf "$TMPDIR"

echo "ALL TOKEN COUNTING TESTS PASSED"
