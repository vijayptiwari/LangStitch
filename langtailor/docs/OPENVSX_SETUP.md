# Open VSX publisher setup (LangTailor Canvas)

Publish `langstitch.langtailor-canvas` to [Open VSX](https://open-vsx.org) so VSCodium, Gitpod, and Theia users can install the canvas extension without downloading a `.vsix`.

## Prerequisites

- GitHub account with access to `vijayptiwari/LangStitch`
- Extension `publisher` in `package.json` is **`langstitch`** (namespace must match)

## Step 1 — Eclipse + GitHub accounts

1. Register at [accounts.eclipse.org](https://accounts.eclipse.org/user/register)
2. In Eclipse profile settings, add your **GitHub username** (must match the account you use on Open VSX)
3. Sign in at [open-vsx.org](https://open-vsx.org) → authorize with **GitHub**
4. On Open VSX **Settings** → **Log in with Eclipse** → link Eclipse account
5. Click **Show Publisher Agreement** → read and **Agree**

Without the Publisher Agreement, `ovsx publish` fails.

## Step 2 — Personal Access Token

1. Open [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens)
2. Create a token (full publish scope)
3. Copy it — shown once

## Step 3 — Create namespace `langstitch`

From repo root (one-time):

```bash
npx ovsx create-namespace langstitch -p YOUR_TOKEN
```

If the namespace already exists, ignore the error.

### Claim verified ownership (recommended)

For a **verified** `langstitch` publisher under the LangStitch org, open an issue at [EclipseFdn/open-vsx.org](https://github.com/EclipseFdn/open-vsx.org/issues) to claim namespace `langstitch`, linking the LangStitch GitHub org.

## Step 4 — GitHub Actions secrets & variables

### Option A — interactive script (Windows)

```powershell
.\langtailor\scripts\setup-openvsx.ps1
```

### Option B — manual `gh` CLI

```bash
gh secret set OVSX_PAT --repo vijayptiwari/LangStitch
gh variable set OPENVSX_PUBLISH_ENABLED --repo vijayptiwari/LangStitch --body true
```

| Name | Type | Value |
|------|------|-------|
| `OVSX_PAT` | Secret | Open VSX token from Step 2 |
| `OPENVSX_PUBLISH_ENABLED` | Variable | `true` |

## Step 5 — Publish

Automatic on every `langtailor-v*` GitHub Release, or run manually:

```bash
gh workflow run "Publish LangTailor to Open VSX" --repo vijayptiwari/LangStitch -f version=0.1.1
```

Verify: [open-vsx.org/extension/langstitch/langtailor-canvas](https://open-vsx.org/extension/langstitch/langtailor-canvas)

Install:

```bash
codium --install-extension langstitch.langtailor-canvas
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| Publisher Agreement not signed | Complete Step 1 on open-vsx.org |
| Namespace does not exist | Run `ovsx create-namespace langstitch` |
| 403 / unauthorized | Regenerate PAT; check `OVSX_PAT` secret |
| Workflow skipped | Set `OPENVSX_PUBLISH_ENABLED=true` repository variable |
