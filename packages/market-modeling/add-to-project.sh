#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(pwd)}"

echo "Installing market-modeling into: $TARGET"
echo ""

# Verify dependencies
command -v claude > /dev/null 2>&1 || { echo "ERROR: claude CLI is required but not installed."; exit 1; }
command -v rsync  > /dev/null 2>&1 || { echo "ERROR: rsync is required but not installed."; exit 1; }

# 1. Copy .claude directory (commands + workflow-team-library)
mkdir -p "$TARGET/.claude"
rsync -a "$PACKAGE_DIR/.claude/" "$TARGET/.claude/"
echo "  [OK] Slash commands and workflow library copied to $TARGET/.claude/"

# 2. Install runner script
cp "$PACKAGE_DIR/market-modeling-run.sh" "$TARGET/market-modeling-run.sh"
chmod +x "$TARGET/market-modeling-run.sh"
echo "  [OK] market-modeling-run.sh installed at $TARGET/"

# 3. Create runs directory
mkdir -p "$TARGET/market-modeling-runs"
echo "  [OK] market-modeling-runs/ directory created"

# 4. Add to skills/index.md if present
INDEX="$TARGET/.claude/skills/index.md"
if [[ -f "$INDEX" ]] && ! grep -q "market-modeling" "$INDEX"; then
  echo "- [market-modeling](../workflow-team-library/market-modeling/manifest.md) — Five-tradition market intelligence: harvest → five-lens analysis → shadow review → synthesis" >> "$INDEX"
  echo "  [OK] Added to skills/index.md"
fi

echo ""
echo "Installation complete."
echo ""
echo "Available slash commands (open Claude Code in $TARGET):"
echo "  /modelise        — Full four-phase run: harvest → analysis → shadow → synthesis"
echo "  /modelise-quick  — Abbreviated scan (2-3 sources, not convergence-validated)"
echo "  /modelise-shadow — Shadow adversarial review of an existing analysis"
echo ""
echo "CLI usage:"
echo "  $TARGET/market-modeling-run.sh \\"
echo "    --question=\"Your market question\" \\"
echo "    run-name"
echo ""
echo "  $TARGET/market-modeling-run.sh \\"
echo "    --quick \\"
echo "    --question=\"Quick scan question\" \\"
echo "    quick-scan"
