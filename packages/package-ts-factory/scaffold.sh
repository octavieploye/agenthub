#!/usr/bin/env bash
set -euo pipefail

# Creates the TypeScript package directory structure.
# Claude writes all content files — this script handles only the skeleton.

NAME=""
OUTPUT="$(pwd)/packages"

for arg in "$@"; do
  case "$arg" in
    --name=*)   NAME="${arg#--name=}" ;;
    --output=*) OUTPUT="${arg#--output=}" ;;
    --help|-h)
      echo "Usage: scaffold.sh --name=<name> [--output=<path>]"
      echo ""
      echo "  --name     kebab-case package name (e.g., lead-scorer)"
      echo "  --output   parent directory for the new package (default: ./packages)"
      exit 0 ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
[[ -z "$NAME" ]] && { echo "ERROR: --name is required."; exit 1; }
echo "$NAME" | grep -qE '^[a-z][a-z0-9-]+$' \
  || { echo "ERROR: name must be kebab-case — lowercase letters, digits, hyphens."; exit 1; }

PKG_DIR="$OUTPUT/$NAME"
[[ -d "$PKG_DIR" ]] && { echo "ERROR: $PKG_DIR already exists."; exit 1; }

# ── Create directory skeleton ─────────────────────────────────────────────────
echo "Scaffolding TypeScript package: $NAME"

mkdir -p "$PKG_DIR/src/types"
mkdir -p "$PKG_DIR/src/schemas"
mkdir -p "$PKG_DIR/src/workflows"
mkdir -p "$PKG_DIR/src/utils"
mkdir -p "$PKG_DIR/src/__tests__"

# ── Write package.json ────────────────────────────────────────────────────────
cat > "$PKG_DIR/package.json" << EOF
{
  "name": "@optimaeus/$NAME",
  "version": "0.1.0",
  "description": "",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "files": ["dist"],
  "license": "UNLICENSED"
}
EOF

# ── Write tsconfig.json ──────────────────────────────────────────────────────
cat > "$PKG_DIR/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/__tests__/**"]
}
EOF

# ── Print manifest ────────────────────────────────────────────────────────────
echo ""
echo "Scaffold complete: $PKG_DIR"
echo ""
echo "Claude writes:"
echo "  $PKG_DIR/src/index.ts                    barrel exports"
echo "  $PKG_DIR/src/types/<domain>.types.ts      one per domain"
echo "  $PKG_DIR/src/types/agent.types.ts         LLMProvider, AgentResult, PromptBuilder"
echo "  $PKG_DIR/src/schemas/<domain>.schema.ts   one per domain"
echo "  $PKG_DIR/src/workflows/<name>/index.ts    orchestrator per workflow"
echo "  $PKG_DIR/src/workflows/<name>/agents/*.ts one per agent"
echo "  $PKG_DIR/src/utils/*.ts                   shared utilities"
echo "  $PKG_DIR/src/__tests__/*.test.ts          one per schema + workflow"
