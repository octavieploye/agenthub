#!/usr/bin/env bash
set -euo pipefail
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PACKAGE_DIR/token-audit.sh"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
export TOKEN_OPT_PROJECT="$TMPDIR"

# Test 1: empty state file → not stuck (exit 0)
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --mode=stuck-check \
  && pass "empty state = not stuck" || fail "empty state should not be stuck"

# Test 2: 3 consecutive Reads → stuck (exit 1)
STATE="$TMPDIR/.token-audit-state"
printf "1|Read|0\n1|Read|0\n1|Read|0\n" > "$STATE"
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --mode=stuck-check \
  && fail "3 consecutive Reads should be stuck" || pass "3 consecutive Reads = stuck (exit 1)"

# Test 3: Read, Write, Read, Read → not stuck (Write resets window)
printf "1|Read|0\n1|Write|1\n1|Read|0\n1|Read|0\n" > "$STATE"
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --mode=stuck-check \
  && pass "Write resets window — not stuck" || fail "Write should reset stuck window"

# Test 4: 5+ calls since last write → stuck
printf "1|Glob|0\n1|Grep|0\n1|Read|0\n1|Glob|0\n1|Grep|0\n" > "$STATE"
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --mode=stuck-check \
  && fail "5 calls no write should be stuck" || pass "5 calls no write = stuck (exit 1)"

echo "ALL STUCK DETECTION TESTS PASSED"
