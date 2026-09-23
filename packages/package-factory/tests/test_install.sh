#!/usr/bin/env bash
set -euo pipefail

PKG="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "=== package-factory install test ==="
echo ""

bash "$PKG/add-to-project.sh" "$TMP" > /dev/null 2>&1
PASS=0; FAIL=0

check() {
  local desc="$1"; local path="$2"
  if [[ -e "$TMP/$path" ]]; then
    echo "  [PASS] $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $desc — missing: $path"
    FAIL=$((FAIL+1))
  fi
}

check "create-package command"   ".claude/commands/create-package.md"
check "scaffold.sh installed"    ".claude/package-factory/scaffold.sh"
check "criteria.md installed"    ".claude/package-factory/criteria.md"

if [[ -x "$TMP/.claude/package-factory/scaffold.sh" ]]; then
  echo "  [PASS] scaffold.sh is executable"
  PASS=$((PASS+1))
else
  echo "  [FAIL] scaffold.sh is not executable"
  FAIL=$((FAIL+1))
fi

# Verify scaffold.sh creates correct structure
SCAFFOLD_TMP=$(mktemp -d)
trap "rm -rf $SCAFFOLD_TMP" EXIT
bash "$TMP/.claude/package-factory/scaffold.sh" \
  --name=test-pkg \
  --type=workflow \
  --output="$SCAFFOLD_TMP" > /dev/null 2>&1

check_scaffold() {
  local desc="$1"; local path="$2"
  if [[ -e "$SCAFFOLD_TMP/$path" ]]; then
    echo "  [PASS] scaffold: $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] scaffold: $desc — missing"
    FAIL=$((FAIL+1))
  fi
}

check_scaffold "commands dir"            "test-pkg/.claude/commands"
check_scaffold "workflow-team-library"   "test-pkg/.claude/workflow-team-library/test-pkg"
check_scaffold "tests dir"              "test-pkg/tests"
check_scaffold "hooks-snippet.json"     "test-pkg/hooks-snippet.json"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
