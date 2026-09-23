#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR=$(mktemp -d)
PASS=0
FAIL=0

check() {
  local desc="$1" path="$2"
  if [[ -e "$path" ]]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc — $path not found"
    FAIL=$((FAIL + 1))
  fi
}

echo "Running install test into: $TMP_DIR"
bash "$SCRIPT_DIR/add-to-project.sh" "$TMP_DIR" > /dev/null 2>&1

check "create-ts-package command" "$TMP_DIR/.claude/commands/create-ts-package.md"
check "scaffold.sh" "$TMP_DIR/.claude/package-ts-factory/scaffold.sh"
check "criteria.md" "$TMP_DIR/.claude/package-ts-factory/criteria.md"
check "scaffold.sh is executable" "$TMP_DIR/.claude/package-ts-factory/scaffold.sh"

# Test scaffold.sh itself
bash "$TMP_DIR/.claude/package-ts-factory/scaffold.sh" --name=test-pkg --output="$TMP_DIR/packages" > /dev/null 2>&1

check "scaffold creates package.json" "$TMP_DIR/packages/test-pkg/package.json"
check "scaffold creates tsconfig.json" "$TMP_DIR/packages/test-pkg/tsconfig.json"
check "scaffold creates src/types/" "$TMP_DIR/packages/test-pkg/src/types"
check "scaffold creates src/schemas/" "$TMP_DIR/packages/test-pkg/src/schemas"
check "scaffold creates src/workflows/" "$TMP_DIR/packages/test-pkg/src/workflows"
check "scaffold creates src/utils/" "$TMP_DIR/packages/test-pkg/src/utils"
check "scaffold creates src/__tests__/" "$TMP_DIR/packages/test-pkg/src/__tests__"

# Verify package.json content
grep -q '"@optimaeus/test-pkg"' "$TMP_DIR/packages/test-pkg/package.json" && {
  echo "  PASS: package.json has correct name"
  PASS=$((PASS + 1))
} || {
  echo "  FAIL: package.json missing @optimaeus scope"
  FAIL=$((FAIL + 1))
}

grep -q '"zod"' "$TMP_DIR/packages/test-pkg/package.json" && {
  echo "  PASS: package.json has zod dependency"
  PASS=$((PASS + 1))
} || {
  echo "  FAIL: package.json missing zod"
  FAIL=$((FAIL + 1))
}

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
