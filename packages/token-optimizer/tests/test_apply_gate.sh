#!/usr/bin/env bash
set -euo pipefail
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$PACKAGE_DIR/token-audit.sh"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

TMPDIR=$(mktemp -d)
export TOKEN_OPT_PROJECT="$TMPDIR"
mkdir -p "$TMPDIR/.claude/skills/token-optimizer" "$TMPDIR/.claude" "$TMPDIR/tmp/token-preview/.claude"
cp "$PACKAGE_DIR/criteria.md" "$TMPDIR/.claude/skills/token-optimizer/criteria.md"

ORIG_CONTENT="NEVER put source files in resources/bin/. This is a long rule with much explanation and narrative that should be compressed significantly to save tokens in the LLM context window, which costs money every time it is loaded."
echo "$ORIG_CONTENT" > "$TMPDIR/.claude/CLAUDE.md"

PROPOSED_CONTENT="NEVER put source files in resources/bin/ — binaries only."
echo "$PROPOSED_CONTENT" > "$TMPDIR/tmp/token-preview/.claude/CLAUDE.md.proposed.md"

# Test 1: --apply without gate PASS files → blocked
APPLY_OUT=$(TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --apply 2>&1 || true)
echo "$APPLY_OUT" | grep -q "BLOCKED\|gates not passed\|Run --judge\|FAIL" \
  && pass "--apply blocked without gate status" \
  || fail "--apply should be blocked without passing gates"

# Test 2: --apply with gates PASS → applies changes
mkdir -p "$TMPDIR/tmp/token-test-results"
echo "PASS" > "$TMPDIR/tmp/token-test-results/.gate-status"
echo "PASS" > "$TMPDIR/tmp/token-preview/.judge-gate-status"
TOKEN_OPT_PROJECT="$TMPDIR" bash "$SCRIPT" --apply

# Original moved to human/
[[ -f "$TMPDIR/human/.claude/CLAUDE.md" ]] \
  && pass "original archived to human/" || fail "original not archived to human/"

# Optimized version written in place
CURRENT=$(cat "$TMPDIR/.claude/CLAUDE.md")
[[ "$CURRENT" == "$PROPOSED_CONTENT" ]] \
  && pass "optimized version written in place" || fail "optimized version not written"

# Log entry added
[[ -f "$TMPDIR/.claude/token-audit-log.md" ]] \
  && pass "audit log updated" || fail "audit log not updated"

rm -rf "$TMPDIR"
echo "ALL APPLY GATE TESTS PASSED"
