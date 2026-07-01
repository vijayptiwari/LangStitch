# Code signing & notarization (Phase 3)

Unsigned portable builds work for development. Production installers need platform certificates to avoid Gatekeeper / SmartScreen warnings.

## Enable signing in CI

Set repository variable:

```bash
gh variable set LANGTAILOR_SIGNING_ENABLED --repo LangStitch/langtailor --body true
```

Signing jobs run only when this is `true` **and** the required secrets are present.

## macOS (Developer ID + notarization)

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded `.p12` Developer ID Application cert |
| `APPLE_CERTIFICATE_PASSWORD` | P12 export password |
| `APPLE_TEAM_ID` | 10-character Team ID |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarytool |

Export cert on a Mac:

```bash
# Keychain → export Developer ID Application cert as .p12
base64 -i DeveloperID.p12 | pbcopy   # paste into GitHub secret
```

CI flow (`langtailor/scripts/sign-macos.sh`):

1. Import cert into ephemeral keychain
2. `codesign` VSCodium.app with hardened runtime
3. Create `.dmg` with `hdiutil`
4. `xcrun notarytool submit` + `stapler staple`

## Windows (Authenticode)

| Secret | Description |
|--------|-------------|
| `WINDOWS_CERTIFICATE_BASE64` | Base64-encoded `.pfx` code-signing cert |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password |

CI flow (`langtailor/scripts/sign-windows.ps1`):

1. Decode PFX to temp file
2. `signtool sign` on `VSCodium.exe` and helper binaries
3. Re-zip portable bundle

## Obtaining certificates

- **Apple:** [Apple Developer Program](https://developer.apple.com/programs/) ($99/year) → Developer ID Application
- **Windows:** EV or standard code-signing cert from DigiCert, Sectigo, etc.

## Local testing

```bash
# macOS (after exporting secrets to env)
./langtailor/scripts/sign-macos.sh arm64 /path/to/bundle

# Windows
.\langtailor\scripts\sign-windows.ps1 -BundleDir C:\path\to\bundle
```

When signing is disabled or secrets are missing, release workflow ships unsigned `.zip` / `.dmg` only.
