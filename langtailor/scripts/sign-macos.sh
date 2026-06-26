#!/usr/bin/env bash
# Optional codesign + notarize for macOS LangTailor bundle.
# Usage: sign-macos.sh arm64|x64 /path/to/bundle-dir
# Requires: APPLE_CERTIFICATE_BASE64, APPLE_CERTIFICATE_PASSWORD, APPLE_TEAM_ID,
#           APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD

set -euo pipefail

ARCH="${1:?arch required}"
BUNDLE="${2:?bundle directory required}"

if [[ "${LANGTAILOR_SIGNING_ENABLED:-}" != "true" ]]; then
  echo "LANGTAILOR_SIGNING_ENABLED is not true — skipping macOS signing"
  exit 0
fi

for var in APPLE_CERTIFICATE_BASE64 APPLE_CERTIFICATE_PASSWORD APPLE_TEAM_ID APPLE_ID APPLE_APP_SPECIFIC_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing $var — skipping macOS signing"
    exit 0
  fi
done

APP="$BUNDLE/VSCodium.app"
if [[ ! -d "$APP" ]]; then
  echo "VSCodium.app not found in $BUNDLE" >&2
  exit 1
fi

KEYCHAIN="$RUNNER_TEMP/langtailor-signing.keychain-db"
P12="$RUNNER_TEMP/cert.p12"
printf '%s' "$APPLE_CERTIFICATE_BASE64" | base64 --decode > "$P12"

security create-keychain -p actions "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p actions "$KEYCHAIN"
security import "$P12" -k "$KEYCHAIN" -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN" login.keychain-db

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" | grep 'Developer ID Application' | head -1 | sed -E 's/.*\"([^\"]+)\".*/\1/')"
if [[ -z "$IDENTITY" ]]; then
  echo "Developer ID Application identity not found in certificate" >&2
  exit 1
fi

echo "Signing with: $IDENTITY"
codesign --force --deep --options runtime --timestamp \
  --entitlements "$(dirname "$0")/../overlay/entitlements.mac.plist" \
  --sign "$IDENTITY" "$APP"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DMG="$ROOT/LangTailor-darwin-${ARCH}.dmg"
rm -f "$DMG"
hdiutil create -volname "LangTailor" -srcfolder "$BUNDLE" -ov -format UDZO "$DMG"

echo "Notarizing $DMG ..."
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple "$DMG"
echo "Signed and notarized: $DMG"
