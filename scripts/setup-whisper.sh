#!/bin/bash
set -euo pipefail

# Setup whisper.cpp binary and model for AgentHub voice input
# Usage: ./scripts/setup-whisper.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_BIN="$PROJECT_DIR/resources/bin"
APP_DATA="$HOME/Library/Application Support/agenthub"
MODEL_DIR="$APP_DATA/models"
WHISPER_TMP="/tmp/whisper.cpp"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"

echo "=== AgentHub Whisper Setup ==="
echo ""

# --- Helper: verify whisper-cli binary is functional and statically linked ---
verify_binary() {
  local binary="$1"

  if ! "$binary" --help >/dev/null 2>&1; then
    echo "  [WARN] Binary at $binary is broken (--help failed)."
    return 1
  fi

  if otool -L "$binary" 2>/dev/null | grep -q '@rpath'; then
    echo "  [WARN] Binary at $binary has @rpath dylib dependencies:"
    otool -L "$binary" | grep '@rpath'
    return 1
  fi

  return 0
}

# --- Step 1: Build whisper-cli ---
needs_build=false

if [ -f "$RESOURCES_BIN/whisper-cli" ]; then
  echo "[1/2] Checking existing whisper-cli..."
  if verify_binary "$RESOURCES_BIN/whisper-cli"; then
    echo "[OK] whisper-cli is functional and statically linked at $RESOURCES_BIN/whisper-cli"
  else
    echo "  Existing binary is broken or dynamically linked — rebuilding..."
    needs_build=true
  fi
else
  needs_build=true
fi

if [ "$needs_build" = true ]; then
  echo "[1/2] Building whisper-cli (static)..."

  if [ -d "$WHISPER_TMP" ]; then
    echo "  Removing stale whisper.cpp clone..."
    rm -rf "$WHISPER_TMP"
  fi

  echo "  Cloning whisper.cpp..."
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$WHISPER_TMP"

  echo "  Compiling (static, Metal-accelerated via CMake)..."
  cmake -B "$WHISPER_TMP/build" -S "$WHISPER_TMP" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_EXAMPLES=ON \
    2>&1 | tail -5

  cmake --build "$WHISPER_TMP/build" --config Release -j "$(sysctl -n hw.ncpu)" 2>&1 | tail -5

  mkdir -p "$RESOURCES_BIN"
  cp "$WHISPER_TMP/build/bin/whisper-cli" "$RESOURCES_BIN/whisper-cli"
  chmod +x "$RESOURCES_BIN/whisper-cli"

  echo "  Verifying static linking..."
  if otool -L "$RESOURCES_BIN/whisper-cli" 2>/dev/null | grep -q '@rpath'; then
    echo "[FAIL] whisper-cli still has @rpath dependencies:"
    otool -L "$RESOURCES_BIN/whisper-cli" | grep '@rpath'
    echo "Static build failed. Leaving $WHISPER_TMP for debugging."
    exit 1
  fi

  echo "  Cleaning up $WHISPER_TMP..."
  rm -rf "$WHISPER_TMP"

  echo "[OK] whisper-cli built (static) and copied to $RESOURCES_BIN/whisper-cli"
fi

echo ""

# --- Step 2: Download model ---
if [ -f "$MODEL_DIR/ggml-small.bin" ]; then
  echo "[OK] ggml-small.bin already exists at $MODEL_DIR/ggml-small.bin"
else
  echo "[2/2] Downloading ggml-small.bin (~500MB)..."
  mkdir -p "$MODEL_DIR"
  curl -L --progress-bar -o "$MODEL_DIR/ggml-small.bin" "$MODEL_URL"
  echo "[OK] Model downloaded to $MODEL_DIR/ggml-small.bin"
fi

echo ""
echo "=== Setup complete ==="
echo "Relaunch AgentHub and voice input (Cmd+E) is ready."
