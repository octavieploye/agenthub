#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(pwd)}"

echo "Installing package-ts-factory into: $TARGET"
echo ""

# 1. Copy slash command
mkdir -p "$TARGET/.claude/commands"
cp "$PACKAGE_DIR/.claude/commands/create-ts-package.md" "$TARGET/.claude/commands/create-ts-package.md"
echo "  [OK] /create-ts-package command installed"

# 2. Copy scaffold.sh into .claude/package-ts-factory/
mkdir -p "$TARGET/.claude/package-ts-factory"
cp "$PACKAGE_DIR/scaffold.sh" "$TARGET/.claude/package-ts-factory/scaffold.sh"
cp "$PACKAGE_DIR/criteria.md" "$TARGET/.claude/package-ts-factory/criteria.md"
chmod +x "$TARGET/.claude/package-ts-factory/scaffold.sh"
echo "  [OK] scaffold.sh installed at .claude/package-ts-factory/"

echo ""
echo "Installation complete."
echo ""
echo "Open Claude Code in $TARGET and run:"
echo "  /create-ts-package"
