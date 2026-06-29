#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(pwd)}"

echo "Installing token-optimizer into: $TARGET"

# Verify dependencies
for dep in curl jq; do
  command -v "$dep" > /dev/null 2>&1 || { echo "ERROR: $dep is required but not installed."; exit 1; }
done

# 1. Copy package files
DEST="$TARGET/.claude/skills/token-optimizer"
mkdir -p "$DEST"
cp "$PACKAGE_DIR/SKILL.md" "$DEST/"
cp "$PACKAGE_DIR/criteria.md" "$DEST/"
cp "$PACKAGE_DIR/token-audit.sh" "$DEST/"
cp "$PACKAGE_DIR/test-scenarios.md" "$DEST/"
chmod +x "$DEST/token-audit.sh"
echo "  [OK] Package files copied to $DEST"

# 2. Create human/ folder
mkdir -p "$TARGET/human"
echo "  [OK] human/ folder created at $TARGET/human"

# 3. Merge hooks into settings.json
SETTINGS="$TARGET/.claude/settings.json"
if [[ ! -f "$SETTINGS" ]]; then
  mkdir -p "$(dirname "$SETTINGS")"
  echo '{"hooks":[]}' > "$SETTINGS"
fi
NEW_HOOKS=$(jq '.hooks' "$PACKAGE_DIR/hooks-snippet.json")
jq --argjson new "$NEW_HOOKS" '.hooks = (.hooks + $new | unique_by(.event + (.matcher.tool_name // [""])[0] + .command))' \
  "$SETTINGS" > "${SETTINGS}.tmp" && mv "${SETTINGS}.tmp" "$SETTINGS"
echo "  [OK] Hooks merged into $SETTINGS"

# 4. Add to skills/index.md if present
INDEX="$TARGET/.claude/skills/index.md"
if [[ -f "$INDEX" ]] && ! grep -q "token-optimizer" "$INDEX"; then
  echo "- [token-optimizer](token-optimizer/SKILL.md) — Audit AI instruction files for token waste and rewrite safely via 5-gate pipeline" >> "$INDEX"
  echo "  [OK] Added to skills/index.md"
fi

# 5. Suggest .gitignore additions (never write)
echo ""
echo "  [ACTION NEEDED] Add these to .gitignore:"
echo "    .token-audit-state"
echo "    .token-audit-baselines/"
echo "    tmp/token-preview/"
echo "    tmp/token-test-results/"

# 6. Suggest cron (never write)
echo ""
echo "  [ACTION NEEDED] Add this cron entry (run: crontab -e):"
echo "    0 8 * * 5  cd $TARGET && .claude/skills/token-optimizer/token-audit.sh --mode=full"

echo ""
echo "Installation complete."
echo "Next steps:"
echo "  1. Apply .gitignore additions above"
echo "  2. Add the cron entry above"
echo "  3. Set ANTHROPIC_API_KEY in your environment"
echo "  4. Run: .claude/skills/token-optimizer/token-audit.sh --dry-run"
