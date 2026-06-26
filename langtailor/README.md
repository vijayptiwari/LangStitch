# LangTailor

**LangTailor** is the downloadable, desktop LangGraph IDE — a branded build of
**VS Code / Code-OSS** (Electron, open source) with the LangStitch visual canvas
built in. Targets: **Windows x64**, **macOS x64**, **macOS arm64**.

It is the desktop successor to the web-hosted LangStitch IDE: a full code editor
plus the drag-and-drop graph canvas and Python export, in one installable app.

## Architecture

```
LangTailor (Code-OSS based desktop IDE)
└── built-in extension: langtailor-canvas
    ├── extension host  (extension/src/extension.ts)  — custom editor for *.langstitch.json
    └── webview         (built from ../src via vite.webview.config.ts) — the React canvas
```

The canvas reuses the existing LangStitch React code (`/src`); a Vite build
bundles it into `extension/media/`, and a VS Code **CustomTextEditor** hosts it
as the editor for `*.langstitch.json`, syncing edits to the TextDocument so VS
Code owns dirty-state, undo, and save.

## Phased roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Canvas as a VS Code extension (custom editor + webview + doc sync) | ✅ done |
| 2 | Branding overlay (`overlay/product.json`) + VSIX CI workflow | ✅ done |
| 2 | GitHub Release: VSIX + Windows + macOS portable zips (VSCodium bundle) | ✅ workflow |
| 2 | Open VSX marketplace publish (`langstitch.langtailor-canvas`) | ✅ workflow (opt-in) |
| 2 | Native macOS .dmg / signed Windows .exe installers | ⏳ |
| 3 | Code signing + notarization (Apple Developer ID, Windows cert) + auto-update | ⏳ |
| 3 | Download page at [langtailor.langstitch.com](https://langtailor.langstitch.com) | ✅ live |

> Phases 2–3 build on GitHub Actions runners (windows-latest / macos-latest) and
> require an Apple Developer ID and a Windows code-signing certificate for
> distributable, non-flagged installers. Unsigned dev builds work without them.

## Develop the extension

```bash
# from repo root — build the canvas webview bundle
npm install
npm run build:webview

# build + run the extension
cd langtailor/extension
npm install
npm run build        # builds webview + compiles extension
# then press F5 in VS Code (Run "LangTailor Canvas Extension")
```

Open or create a `*.langstitch.json` file to launch the canvas editor.

## Publish a release

```bash
# Tag push (creates GitHub Release with VSIX + platform portable zips)
git tag langtailor-v0.1.1
git push origin langtailor-v0.1.1

# Or run manually: Actions → LangTailor Release → Run workflow
```

Downloads appear at [langtailor.langstitch.com](https://langtailor.langstitch.com) and
[GitHub Releases](https://github.com/vijayptiwari/LangStitch/releases).

### Open VSX (extension marketplace)

The canvas extension can be published to [Open VSX](https://open-vsx.org) for VSCodium /
Gitpod / Eclipse Theia users:

1. Create a publisher at [open-vsx.org](https://open-vsx.org) named `langstitch`
2. Generate a Personal Access Token
3. Add repo secret `OVSX_PAT`
4. Set repository variable `OPENVSX_PUBLISH_ENABLED` = `true`
5. Publish runs automatically on `langtailor-v*` GitHub Releases, or via
   **Actions → Publish LangTailor to Open VSX**

Install: `codium --install-extension langstitch.langtailor-canvas`

## Why VS Code / Code-OSS (not "Visual Studio")

Visual Studio is proprietary and not Electron-based. VS Code's core (**Code-OSS**)
is MIT-licensed and is the standard base for branded IDEs (Cursor, Windsurf,
Gitpod). LangTailor follows the maintainable VSCodium-style overlay approach:
pin an upstream Code-OSS version, apply branding patches, bundle the canvas
extension, and build installers per platform.
