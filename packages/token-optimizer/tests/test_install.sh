#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER="$PACKAGE_DIR/install.sh"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

TARGET=$(mktemp -d)
trap 'rm -rf "$TARGET"' EXIT
mkdir -p "$TARGET/.claude"
echo '{"hooks":[]}' > "$TARGET/.claude/settings.json"
mkdir -p "$TARGET/.claude/skills"
echo "## Skills" > "$TARGET/.claude/skills/index.md"

bash "$INSTALLER" "$TARGET"

assert_file() { [[ -f "$1" ]] && pass "$(basename $1) installed" || fail "$1 not installed"; }

assert_file "$TARGET/.claude/skills/token-optimizer/SKILL.md"
assert_file "$TARGET/.claude/skills/token-optimizer/criteria.md"
assert_file "$TARGET/.claude/skills/token-optimizer/token-audit.sh"
assert_file "$TARGET/.claude/skills/token-optimizer/test-scenarios.md"

[[ -x "$TARGET/.claude/skills/token-optimizer/token-audit.sh" ]] \
  && pass "token-audit.sh is executable" || fail "token-audit.sh not executable"

[[ -d "$TARGET/human" ]] && pass "human/ created" || fail "human/ not created"

jq '.hooks | length > 0' "$TARGET/.claude/settings.json" | grep -q true \
  && pass "hooks merged into settings.json" || fail "hooks not merged"

grep -q "token-optimizer" "$TARGET/.claude/skills/index.md" \
  && pass "skill added to index.md" || fail "skill not in index.md"

echo "ALL INSTALL TESTS PASSED"
