#!/usr/bin/env bash
set -euo pipefail

PKG="$(cd "$(dirname "$0")/.." && pwd)"
COMMANDS="$PKG/.claude/commands"
LIBRARY="$PKG/.claude/workflow-team-library/market-modeling"
RUNNER="$PKG/market-modeling-run.sh"

echo "=== market-modeling scenario tests ==="
echo ""

PASS=0; FAIL=0

contains() {
  local desc="$1"; local file="$2"; local pattern="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $desc"
    echo "          pattern: $pattern"
    echo "          file:    $file"
    FAIL=$((FAIL+1))
  fi
}

not_contains() {
  local desc="$1"; local file="$2"; local pattern="$3"
  if ! grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  [PASS] $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $desc — prohibited pattern found: $pattern"
    echo "          file: $file"
    FAIL=$((FAIL+1))
  fi
}

file_exists() {
  local desc="$1"; local file="$2"
  if [[ -f "$file" ]]; then
    echo "  [PASS] $desc"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $desc — missing: $file"
    FAIL=$((FAIL+1))
  fi
}

# ── Command frontmatter ───────────────────────────────────────────────────────
echo "--- Command frontmatter ---"
contains "optimise has name frontmatter"        "$COMMANDS/optimise.md"        "^name:"
contains "optimise-quick has name frontmatter"  "$COMMANDS/optimise-quick.md"  "^name:"
contains "optimise-shadow has name frontmatter" "$COMMANDS/optimise-shadow.md" "^name:"

# ── Phase files present ───────────────────────────────────────────────────────
echo ""
echo "--- Phase files ---"
file_exists "phase-1-harvest.md"   "$LIBRARY/phase-1-harvest.md"
file_exists "phase-2-analysis.md"  "$LIBRARY/phase-2-analysis.md"
file_exists "phase-3-shadow.md"    "$LIBRARY/phase-3-shadow.md"
file_exists "phase-4-synthesis.md" "$LIBRARY/phase-4-synthesis.md"
file_exists "handoffs.md"          "$LIBRARY/handoffs.md"

# ── MM-001: Source diversity enforced ─────────────────────────────────────────
echo ""
echo "--- MM-001: Source diversity ---"
contains "phase-1 requires minimum 5 sources"   "$LIBRARY/phase-1-harvest.md" "minimum of five"
contains "phase-1 requires 3 tradition clusters" "$LIBRARY/phase-1-harvest.md" "three tradition clusters"
contains "gate 1 has source count check"         "$LIBRARY/handoffs.md"        "minimum 5"

# ── MM-002: Corporate source not primary ─────────────────────────────────────
echo ""
echo "--- MM-002: Corporate source authority ---"
contains "phase-1 never treats corporate as ground truth" "$LIBRARY/phase-1-harvest.md" "never as ground truth"
contains "gate 1 checks corporate source rule"            "$LIBRARY/handoffs.md"        "No corporate source treated"

# ── MM-003: Point predictions refused ────────────────────────────────────────
echo ""
echo "--- MM-003: Point prediction refusal ---"
contains     "phase-4 prohibits confidence percentages"    "$LIBRARY/phase-4-synthesis.md" "NO confidence percentages"
not_contains "phase-4 output format has no confidence %"  "$LIBRARY/phase-4-synthesis.md" "confidence: [0-9]"
contains     "gate 4 prohibits confidence percentages"     "$LIBRARY/handoffs.md"          "NO confidence percentages"

# ── MM-004: Shadow step mandatory ────────────────────────────────────────────
echo ""
echo "--- MM-004: Shadow step mandatory ---"
contains "optimise command references phase-3-shadow"   "$COMMANDS/optimise.md"          "phase-3-shadow"
contains "handoffs has gate 3 checklist"                "$LIBRARY/handoffs.md"           "Gate 3"
contains "phase-4 requires shadow integrated"           "$LIBRARY/phase-4-synthesis.md"  "Shadow findings integrated"
contains "gate 4 fails if shadow absent"                "$LIBRARY/handoffs.md"           "Shadow findings absent"

# ── MM-005: Lens skipping is a gate failure ───────────────────────────────────
echo ""
echo "--- MM-005: Lens skipping ---"
contains "gate 2 fails if lens missing"    "$LIBRARY/handoffs.md"        "Gate 2 fails if"
contains "analysis silence is a finding"   "$LIBRARY/phase-2-analysis.md" "silence is a finding"
contains "phase-2 has all 5 lenses"        "$LIBRARY/phase-2-analysis.md" "LENS 5"

# ── MM-006: Convergence declaration ──────────────────────────────────────────
echo ""
echo "--- MM-006: Convergence declaration ---"
contains "phase-4 marks convergent findings"       "$LIBRARY/phase-4-synthesis.md" "CONVERGENT"
contains "handoffs require convergent marking"     "$LIBRARY/handoffs.md"          "CONVERGENT"
contains "gate 4 requires convergence present"     "$LIBRARY/handoffs.md"          "At least one"

# ── MM-007: Output format discipline ─────────────────────────────────────────
echo ""
echo "--- MM-007: Output format ---"
contains     "phase-4 prohibits summary verdict"   "$LIBRARY/phase-4-synthesis.md" "NO summary verdict"
contains     "phase-4 prohibits triage table"      "$LIBRARY/phase-4-synthesis.md" "NO triage table"
contains     "phase-4 prohibits executive summary" "$LIBRARY/phase-4-synthesis.md" "NO executive summary"
contains     "gate 4 checks format prohibitions"   "$LIBRARY/handoffs.md"          "NO summary verdict"

# ── Runner flags ──────────────────────────────────────────────────────────────
echo ""
echo "--- Runner flags ---"
file_exists "runner script exists"          "$RUNNER"
contains    "runner has --question flag"    "$RUNNER" "\-\-question"
contains    "runner has --quick flag"       "$RUNNER" "\-\-quick"
contains    "runner has --run-dir flag"     "$RUNNER" "\-\-run-dir"
contains    "runner uses claude --print"    "$RUNNER" "claude --print"
contains    "runner uses bypassPermissions" "$RUNNER" "bypassPermissions"
contains    "runner runs 4 phases"          "$RUNNER" "phase-4"

if [[ -x "$RUNNER" ]]; then
  echo "  [PASS] runner is executable"
  PASS=$((PASS+1))
else
  echo "  [FAIL] runner is not executable"
  FAIL=$((FAIL+1))
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
