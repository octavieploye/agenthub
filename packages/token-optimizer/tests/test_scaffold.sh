#!/usr/bin/env bash
set -euo pipefail
PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

assert_file() { [[ -f "$1" ]] && pass "$1 exists" || fail "$1 not found"; }

assert_file "$PACKAGE_DIR/criteria.md"
assert_file "$PACKAGE_DIR/test-scenarios.md"
assert_file "$PACKAGE_DIR/hooks-snippet.json"

jq . "$PACKAGE_DIR/hooks-snippet.json" > /dev/null 2>&1 \
  && pass "hooks-snippet.json is valid JSON" \
  || fail "hooks-snippet.json is invalid JSON"

grep -q "CR_RULES" "$PACKAGE_DIR/criteria.md" \
  && pass "criteria.md has CR_RULES" \
  || fail "criteria.md missing CR_RULES"

grep -q "Compliance check:" "$PACKAGE_DIR/test-scenarios.md" \
  && pass "test-scenarios.md has compliance checks" \
  || fail "test-scenarios.md missing compliance checks"

echo "ALL SCAFFOLD TESTS PASSED"
