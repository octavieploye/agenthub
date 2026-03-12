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

# --- Step 1: Build whisper-cli ---
if [ -f "$RESOURCES_BIN/whisper-cli" ]; then
  echo "[OK] whisper-cli already exists at $RESOURCES_BIN/whisper-cli"
else
  echo "[1/2] Building whisper-cli..."

  if [ -d "$WHISPER_TMP" ]; then
    echo "  Updating existing whisper.cpp clone..."
    git -C "$WHISPER_TMP" pull --quiet
  else
    echo "  Cloning whisper.cpp..."
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp "$WHISPER_TMP"
  fi

  echo "  Compiling (Metal-accelerated via CMake)..."
  cmake -B "$WHISPER_TMP/build" -S "$WHISPER_TMP" -DCMAKE_BUILD_TYPE=Release 2>&1 | tail -5
  cmake --build "$WHISPER_TMP/build" --config Release -j "$(sysctl -n hw.ncpu)" 2>&1 | tail -5

  mkdir -p "$RESOURCES_BIN"
  cp "$WHISPER_TMP/build/bin/whisper-cli" "$RESOURCES_BIN/whisper-cli"
  chmod +x "$RESOURCES_BIN/whisper-cli"

  echo "[OK] whisper-cli built and copied to $RESOURCES_BIN/whisper-cli"
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
