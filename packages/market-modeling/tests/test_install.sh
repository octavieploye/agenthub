#!/usr/bin/env bash
set -euo pipefail

PKG="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "=== market-modeling install test ==="
echo ""

# Run install into temp dir
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

echo "--- Slash commands ---"
check "optimise command"            ".claude/commands/optimise.md"
check "optimise-quick command"      ".claude/commands/optimise-quick.md"
check "optimise-shadow command"     ".claude/commands/optimise-shadow.md"

echo ""
echo "--- Workflow library ---"
check "manifest"          ".claude/workflow-team-library/market-modeling/manifest.md"
check "team"              ".claude/workflow-team-library/market-modeling/team.md"
check "phase-1-harvest"   ".claude/workflow-team-library/market-modeling/phase-1-harvest.md"
check "phase-2-analysis"  ".claude/workflow-team-library/market-modeling/phase-2-analysis.md"
check "phase-3-shadow"    ".claude/workflow-team-library/market-modeling/phase-3-shadow.md"
check "phase-4-synthesis" ".claude/workflow-team-library/market-modeling/phase-4-synthesis.md"
check "handoffs"          ".claude/workflow-team-library/market-modeling/handoffs.md"

echo ""
echo "--- Runner ---"
check "runner script installed"   "market-modeling-run.sh"
check "runs directory created"    "market-modeling-runs"

if [[ -x "$TMP/market-modeling-run.sh" ]]; then
  echo "  [PASS] runner is executable"
  PASS=$((PASS+1))
else
  echo "  [FAIL] runner is not executable"
  FAIL=$((FAIL+1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
