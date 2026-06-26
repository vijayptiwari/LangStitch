#!/usr/bin/env bash
# Bundle LangTailor canvas VSIX into a portable VSCodium (Code-OSS) macOS zip.
# Usage: bundle-macos.sh arm64|x64
# Run on macos-latest in CI after VSIX is in dist-langtailor/.

set -euo pipefail

ARCH="${1:?Usage: bundle-macos.sh arm64|x64}"

case "$ARCH" in
  arm64)
    ASSET_PATTERN='^VSCodium-darwin-arm64-.+\.zip$'
    OUT_ZIP="LangTailor-darwin-arm64-portable.zip"
    OUT_DMG="LangTailor-darwin-arm64.dmg"
    ;;
  x64)
    ASSET_PATTERN='^VSCodium-darwin-x64-.+\.zip$'
    OUT_ZIP="LangTailor-darwin-x64-portable.zip"
    OUT_DMG="LangTailor-darwin-x64.dmg"
    ;;
  *)
    echo "Unknown arch: $ARCH (expected arm64 or x64)" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mapfile -t VSIX_FILES < <(find "$ROOT/dist-langtailor" -maxdepth 1 -name '*.vsix' | sort)
if [[ ${#VSIX_FILES[@]} -eq 0 ]]; then
  echo "No .vsix found in $ROOT/dist-langtailor" >&2
  exit 1
fi
echo "Using VSIX files:"
for f in "${VSIX_FILES[@]}"; do echo "  $f"; done

CURL_API=(curl -fsSL -H "User-Agent: LangTailor-Release-CI" -H "Accept: application/vnd.github+json")
CURL_DL=(curl -fsSL -L -H "User-Agent: LangTailor-Release-CI" -H "Accept: application/octet-stream")
if [[ -n "${GH_TOKEN:-}" ]]; then
  CURL_API+=(-H "Authorization: Bearer $GH_TOKEN")
  CURL_DL+=(-H "Authorization: Bearer $GH_TOKEN")
fi

RELEASE_JSON="$("${CURL_API[@]}" https://api.github.com/repos/VSCodium/vscodium/releases/latest)"
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
"${CURL_DL[@]}" "$ASSET_URL" -o "$ZIP_PATH"
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

EXT_DIR="$APP/Contents/Resources/app/extensions"
mkdir -p "$EXT_DIR"

install_builtin_vsix() {
  local vsix="$1"
  local tmp
  tmp="$(mktemp -d)"
  unzip -q "$vsix" -d "$tmp"
  local pkg="$tmp/extension/package.json"
  if [[ ! -f "$pkg" ]]; then
    echo "Invalid VSIX (no extension/package.json): $vsix" >&2
    rm -rf "$tmp"
    exit 1
  fi
  local ext_id
  ext_id="$(python3 -c "import json; print(json.load(open('$pkg'))['name'])")"
  rm -rf "$EXT_DIR/$ext_id"
  cp -R "$tmp/extension" "$EXT_DIR/$ext_id"
  rm -rf "$tmp"
  echo "Installed built-in extension: $ext_id"
}

echo "Installing extensions as built-in into $EXT_DIR ..."
for VSIX in "${VSIX_FILES[@]}"; do
  install_builtin_vsix "$VSIX"
done

# Legacy portable layout (extensions + user-data) for LangTailor.command launcher
LEGACY_EXT_DIR="$BUNDLE/extensions"
LEGACY_DATA_DIR="$BUNDLE/user-data"
mkdir -p "$LEGACY_EXT_DIR" "$LEGACY_DATA_DIR"
cp -R "$EXT_DIR"/* "$LEGACY_EXT_DIR/" 2>/dev/null || true

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

OUT_ZIP_PATH="$ROOT/$OUT_ZIP"
OUT_DMG_PATH="$ROOT/$OUT_DMG"
rm -f "$OUT_ZIP_PATH" "$OUT_DMG_PATH"
(
  cd "$BUNDLE"
  zip -qr "$OUT_ZIP_PATH" VSCodium.app extensions user-data LangTailor.command
)
echo "Created $OUT_ZIP_PATH ($(wc -c < "$OUT_ZIP_PATH") bytes)"

echo "Creating DMG ..."
hdiutil create -volname "LangTailor" -srcfolder "$BUNDLE" -ov -format UDZO "$OUT_DMG_PATH"
echo "Created $OUT_DMG_PATH ($(wc -c < "$OUT_DMG_PATH") bytes)"
