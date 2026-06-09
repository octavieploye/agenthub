#!/usr/bin/env bash
set -euo pipefail

PIPER_VERSION="2023.11.14-2"
VOICES_DIR="$(dirname "$0")/../resources/voices"
BIN_DIR="$(dirname "$0")/../resources/bin"
mkdir -p "$VOICES_DIR" "$BIN_DIR"

# -- Piper binary
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  PIPER_ARCHIVE="piper_macos_aarch64.tar.gz"
else
  PIPER_ARCHIVE="piper_macos_x86_64.tar.gz"
fi

PIPER_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/${PIPER_ARCHIVE}"

PIPER_DIST_DIR="$BIN_DIR/piper-dist"

# NOTE: The rhasspy/piper macOS release (both aarch64 and x86_64 archives) ships
# an x86_64 binary. On Apple Silicon it runs under Rosetta 2. Dylibs must also be
# x86_64 to match. We always download piper-phonemize_macos_x64 for the dylibs.
PP_URL="https://github.com/rhasspy/piper-phonemize/releases/download/2023.11.14-4/piper-phonemize_macos_x64.tar.gz"

if [ ! -f "$PIPER_DIST_DIR/piper" ]; then
  echo "Downloading piper binary ($ARCH)..."
  TMP=$(mktemp -d)

  # Download and extract piper
  curl -fSL "$PIPER_URL" -o "$TMP/piper.tar.gz"
  tar -xzf "$TMP/piper.tar.gz" -C "$TMP"
  mkdir -p "$PIPER_DIST_DIR"
  cp -r "$TMP/piper/." "$PIPER_DIST_DIR/"
  chmod -R u+w "$PIPER_DIST_DIR/"
  chmod +x "$PIPER_DIST_DIR/piper"

  # Download and extract piper-phonemize x86_64 dylibs (required by piper binary)
  echo "Downloading piper-phonemize dylibs (x86_64)..."
  curl -fSL "$PP_URL" -o "$TMP/pp.tar.gz"
  tar -xzf "$TMP/pp.tar.gz" -C "$TMP"
  cp "$TMP/piper-phonemize/lib/"*.dylib "$PIPER_DIST_DIR/"

  # Patch rpath so piper finds co-located dylibs via @loader_path
  install_name_tool -add_rpath @loader_path "$PIPER_DIST_DIR/piper" 2>/dev/null || true

  rm -rf "$TMP"
  echo "Piper distribution installed at $PIPER_DIST_DIR"
else
  echo "Piper distribution already present, skipping."
fi

# Convenience symlink so callers can use resources/bin/piper directly
if [ ! -L "$BIN_DIR/piper" ] && [ ! -f "$BIN_DIR/piper" ]; then
  ln -s "$PIPER_DIST_DIR/piper" "$BIN_DIR/piper"
fi

# -- Voice models (onnx + onnx.json pairs)
HF_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

download_voice() {
  local VOICE_ID="$1"
  local LANG="$2"
  local LANG_FULL="$3"
  local NAME="$4"
  local QUALITY="$5"

  local ONNX="$VOICES_DIR/${VOICE_ID}.onnx"
  local JSON="$VOICES_DIR/${VOICE_ID}.onnx.json"

  if [ ! -f "$ONNX" ]; then
    echo "Downloading voice ${VOICE_ID}..."
    curl -fSL "${HF_BASE}/${LANG}/${LANG_FULL}/${NAME}/${QUALITY}/${VOICE_ID}.onnx" -o "$ONNX"
    curl -fSL "${HF_BASE}/${LANG}/${LANG_FULL}/${NAME}/${QUALITY}/${VOICE_ID}.onnx.json" -o "$JSON"
    echo "Voice ${VOICE_ID} downloaded."
  else
    echo "Voice ${VOICE_ID} already present, skipping."
  fi
}

download_voice "en_US-amy-medium"       "en" "en_US" "amy"      "medium"
download_voice "fr_FR-siwis-medium"     "fr" "fr_FR" "siwis"    "medium"
download_voice "es_ES-sharvard-medium"  "es" "es_ES" "sharvard" "medium"

echo "Setup complete."
