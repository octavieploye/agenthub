#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(pwd)}"

echo "Installing package-factory into: $TARGET"
echo ""

command -v rsync > /dev/null 2>&1 || { echo "ERROR: rsync is required but not installed."; exit 1; }

# 1. Copy slash command
mkdir -p "$TARGET/.claude/commands"
cp "$PACKAGE_DIR/.claude/commands/create-package.md" "$TARGET/.claude/commands/create-package.md"
echo "  [OK] /create-package command installed"

# 2. Copy scaffold.sh into .claude/package-factory/
mkdir -p "$TARGET/.claude/package-factory"
cp "$PACKAGE_DIR/scaffold.sh" "$TARGET/.claude/package-factory/scaffold.sh"
cp "$PACKAGE_DIR/criteria.md" "$TARGET/.claude/package-factory/criteria.md"
chmod +x "$TARGET/.claude/package-factory/scaffold.sh"
echo "  [OK] scaffold.sh installed at .claude/package-factory/"

echo ""
echo "Installation complete."
echo ""
echo "Open Claude Code in $TARGET and run:"
echo "  /create-package"
