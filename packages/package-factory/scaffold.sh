#!/usr/bin/env bash
set -euo pipefail

# Creates the directory structure and writes hooks-snippet.json.
# Claude writes all content files — this script handles only the skeleton.

NAME=""
TYPE="workflow"
OUTPUT="$(pwd)/packages"

for arg in "$@"; do
  case "$arg" in
    --name=*)   NAME="${arg#--name=}" ;;
    --type=*)   TYPE="${arg#--type=}" ;;
    --output=*) OUTPUT="${arg#--output=}" ;;
    --help|-h)
      echo "Usage: scaffold.sh --name=<name> [--type=workflow|tool] [--output=<path>]"
      echo ""
      echo "  --name     kebab-case package name (e.g., lead-scorer)"
      echo "  --type     workflow (default) or tool"
      echo "  --output   parent directory for the new package (default: ./packages)"
      exit 0 ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
[[ -z "$NAME" ]] && { echo "ERROR: --name is required."; exit 1; }
echo "$NAME" | grep -qE '^[a-z][a-z0-9-]+$' \
  || { echo "ERROR: name must be kebab-case — lowercase letters, digits, hyphens (e.g., lead-scorer)."; exit 1; }
[[ "$TYPE" != "workflow" && "$TYPE" != "tool" ]] \
  && { echo "ERROR: --type must be 'workflow' or 'tool'."; exit 1; }

PKG_DIR="$OUTPUT/$NAME"
[[ -d "$PKG_DIR" ]] && { echo "ERROR: $PKG_DIR already exists. Choose a different name or remove it first."; exit 1; }

# ── Create directory skeleton ─────────────────────────────────────────────────
echo "Scaffolding $TYPE package: $NAME"

mkdir -p "$PKG_DIR/.claude/commands"
mkdir -p "$PKG_DIR/tests"

if [[ "$TYPE" == "workflow" ]]; then
  mkdir -p "$PKG_DIR/.claude/workflow-team-library/$NAME"
fi

# The one file that is always identical regardless of package content
echo '{"hooks": []}' > "$PKG_DIR/hooks-snippet.json"

# ── Print manifest of what Claude must write ──────────────────────────────────
echo ""
echo "Scaffold complete: $PKG_DIR"
echo ""
echo "Claude writes:"
echo "  $PKG_DIR/SKILL.md"
echo "  $PKG_DIR/criteria.md"
echo "  $PKG_DIR/test-scenarios.md"
echo "  $PKG_DIR/add-to-project.sh"
echo "  $PKG_DIR/tests/test_install.sh"
echo "  $PKG_DIR/tests/test_scenarios.sh"

if [[ "$TYPE" == "workflow" ]]; then
  echo "  $PKG_DIR/.claude/commands/<command>.md  (one per slash command)"
  echo "  $PKG_DIR/.claude/workflow-team-library/$NAME/manifest.md"
  echo "  $PKG_DIR/.claude/workflow-team-library/$NAME/team.md"
  echo "  $PKG_DIR/.claude/workflow-team-library/$NAME/phase-N-*.md  (one per phase)"
  echo "  $PKG_DIR/.claude/workflow-team-library/$NAME/handoffs.md"
  echo "  $PKG_DIR/$NAME-run.sh"
else
  echo "  $PKG_DIR/$NAME.sh"
  echo "  $PKG_DIR/install.sh"
fi
