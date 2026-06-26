#!/usr/bin/env bash
# Bundle LangTailor canvas VSIX into a portable VSCodium (Code-OSS) macOS zip.
# Usage: bundle-macos.sh arm64|x64
# Run on macos-latest in CI after VSIX is in dist-langtailor/.

set -euo pipefail

ARCH="${1:?Usage: bundle-macos.sh arm64|x64}"

case "$ARCH" in
  arm64)
    ASSET_PATTERN='^VSCodium-darwin-arm64-.+\.zip$'
    OUT_NAME="LangTailor-darwin-arm64-portable.zip"
    ;;
  x64)
    ASSET_PATTERN='^VSCodium-darwin-x64-.+\.zip$'
    OUT_NAME="LangTailor-darwin-x64-portable.zip"
    ;;
  *)
    echo "Unknown arch: $ARCH (expected arm64 or x64)" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VSIX="$(find "$ROOT/dist-langtailor" -maxdepth 1 -name '*.vsix' | head -1)"
if [[ -z "$VSIX" ]]; then
  echo "No .vsix found in $ROOT/dist-langtailor" >&2
  exit 1
fi
echo "Using VSIX: $VSIX"

RELEASE_JSON="$(curl -fsSL https://api.github.com/repos/VSCodium/vscodium/releases/latest)"
ASSET_URL="$(echo "$RELEASE_JSON" | python3 -c "
import json, re, sys
data = json.load(sys.stdin)
pat = re.compile(r'${ASSET_PATTERN}')
for a in data.get('assets', []):
    if pat.match(a['name']):
        print(a['browser_download_url'])
        break
")"

if [[ -z "$ASSET_URL" ]]; then
  echo "VSCodium macOS zip not found for arch=$ARCH" >&2
  exit 1
fi

WORK="${RUNNER_TEMP:-/tmp}/langtailor-macos-$$"
BUNDLE="$WORK/bundle"
mkdir -p "$BUNDLE"
trap 'rm -rf "$WORK"' EXIT

ZIP_PATH="$WORK/vscodium.zip"
echo "Downloading VSCodium ($ARCH) ..."
curl -fsSL "$ASSET_URL" -o "$ZIP_PATH"
unzip -q "$ZIP_PATH" -d "$BUNDLE"

APP="$(find "$BUNDLE" -maxdepth 2 -name 'VSCodium.app' -type d | head -1)"
if [[ -z "$APP" ]]; then
  echo "VSCodium.app not found after extract" >&2
  exit 1
fi

CODIUM="$APP/Contents/Resources/app/bin/codium"
if [[ ! -f "$CODIUM" ]]; then
  echo "codium binary not found at $CODIUM" >&2
  exit 1
fi
chmod +x "$CODIUM"

EXT_DIR="$BUNDLE/extensions"
DATA_DIR="$BUNDLE/user-data"
mkdir -p "$EXT_DIR" "$DATA_DIR"

echo "Installing extension into portable bundle ..."
"$CODIUM" --install-extension "$VSIX" --force \
  --extensions-dir "$EXT_DIR" \
  --user-data-dir "$DATA_DIR"

LAUNCHER="$BUNDLE/LangTailor.command"
cat > "$LAUNCHER" <<'LAUNCH'
#!/bin/zsh
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/VSCodium.app"
exec "$APP/Contents/MacOS/Electron" \
  --extensions-dir "$ROOT/extensions" \
  --user-data-dir "$ROOT/user-data" \
  "$@"
LAUNCH
chmod +x "$LAUNCHER"

OUT_ZIP="$ROOT/$OUT_NAME"
rm -f "$OUT_ZIP"
(
  cd "$BUNDLE"
  zip -qr "$OUT_ZIP" VSCodium.app extensions user-data LangTailor.command
)
echo "Created $OUT_ZIP ($(wc -c < "$OUT_ZIP") bytes)"
