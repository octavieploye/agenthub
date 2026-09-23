#!/usr/bin/env zsh
# add-to-project.sh — Deploy market-sim package into any project
#
# Usage:
#   ./add-to-project.sh                   # deploys into current directory
#   ./add-to-project.sh /path/to/project  # deploys into specified directory

TARGET="${1:-.}"
TARGET="${TARGET:A}"

[[ -d "$TARGET" ]] || { echo "Error: target directory does not exist: $TARGET"; exit 1 }

PACKAGE_DIR="${0:A:h}"

rsync -av "$PACKAGE_DIR/.claude/"         "$TARGET/.claude/"
rsync -av "$PACKAGE_DIR/market-sim-run.sh" "$TARGET/market-sim-run.sh"
chmod +x "$TARGET/market-sim-run.sh"

echo ""
echo "Market simulation workflow deployed to: $TARGET"
echo ""
echo "Slash commands available:"
echo "  /market-sim-start   full workflow (interactive brief)"
echo "  /market-sim-p1      Phase 1: Business Research + Geo Psychology"
echo "  /market-sim-p2      Phase 2: Data Analysis"
echo "  /market-sim-p3      Phase 3: Statistical Validation"
echo "  /market-sim-p4      Phase 4: Pre-Offer Intelligence"
echo "  /market-sim-p5      Phase 5: [source] Offer Engineering"
echo "  /market-sim-p6      Phase 6: Market Simulation (5–10 scenarios)"
echo ""
echo "CLI runner:"
echo "  cd $TARGET && ./market-sim-run.sh --brief brief.md <product-name>"
