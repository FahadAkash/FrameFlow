#!/bin/bash
# FrameFlow — macOS installer
# 1) Enables CEP "debug mode" so an unsigned panel is allowed to load.
# 2) Copies this extension into the per-user Adobe CEP extensions folder.
#
# Run:  chmod +x install-mac.command  then double-click it (or run in Terminal).

set -e
BUNDLE_ID="com.aigeolab.frameflow.free"
SOURCE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$BUNDLE_ID"

echo "FrameFlow installer"
echo "--------------------"

# 1. Enable PlayerDebugMode for every CEP runtime Premiere might use
for v in 6 7 8 9 10 11 12; do
    defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
    defaults write "com.adobe.CSXS.$v" LogLevel 1 2>/dev/null || true
done
echo "[ok] CEP debug mode enabled (CSXS.6 - CSXS.12)"

# 2. Copy the extension
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SOURCE/CSXS"   "$DEST/"
cp -R "$SOURCE/client" "$DEST/"
cp -R "$SOURCE/host"   "$DEST/"
[ -f "$SOURCE/.debug" ] && cp "$SOURCE/.debug" "$DEST/"

echo "[ok] Installed to:"
echo "     $DEST"
echo ""
echo "Now fully quit Premiere Pro and relaunch it."
echo "Open the panel:  Window > Extensions > FrameFlow Free"
