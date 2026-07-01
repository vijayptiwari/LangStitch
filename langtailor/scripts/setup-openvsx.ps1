# Configure Open VSX publishing for LangStitch/langtailor.
# Run from repo root after completing eclipse.org + open-vsx.org publisher agreement.

$ErrorActionPreference = "Stop"
$Repo = "LangStitch/langtailor"

Write-Host ""
Write-Host "LangTailor Open VSX setup" -ForegroundColor Cyan
Write-Host "========================="
Write-Host ""
Write-Host "Before continuing, ensure you have:"
Write-Host "  1. Signed the Eclipse Open VSX Publisher Agreement at open-vsx.org"
Write-Host "  2. Linked Eclipse + GitHub accounts on open-vsx.org"
Write-Host "  3. Generated a PAT at https://open-vsx.org/user-settings/tokens"
Write-Host ""
Write-Host "Full guide: langtailor/docs/OPENVSX_SETUP.md"
Write-Host ""

$pat = Read-Host "Paste Open VSX PAT (input hidden)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pat)
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "PAT is required"
}

Write-Host ""
Write-Host "Creating namespace langstitch (ignore error if it already exists) ..."
try {
  npx --yes ovsx create-namespace langstitch -p $token
} catch {
  Write-Host "Namespace step finished (may already exist)."
}

Write-Host ""
Write-Host "Setting GitHub secret OVSX_PAT ..."
gh secret set OVSX_PAT --repo $Repo --body $token

Write-Host "Enabling OPENVSX_PUBLISH_ENABLED ..."
gh variable set OPENVSX_PUBLISH_ENABLED --repo $Repo --body "true"

Write-Host ""
$publish = Read-Host "Publish langtailor-canvas 0.1.1 now? [y/N]"
if ($publish -match '^[yY]') {
  gh workflow run "Publish LangTailor to Open VSX" --repo $Repo -f version=0.1.1
  Write-Host "Workflow started. Watch: https://github.com/$Repo/actions"
} else {
  Write-Host "Skipped publish. Run later:"
  Write-Host "  gh workflow run `"Publish LangTailor to Open VSX`" --repo $Repo -f version=0.1.1"
}

Write-Host ""
Write-Host "Done. Extension URL (after publish):"
Write-Host "  https://open-vsx.org/extension/langstitch/langtailor-canvas"
