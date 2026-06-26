# Bundle LangTailor canvas VSIX into a portable VSCodium (Code-OSS) Windows zip.
# Run on windows-latest in CI after the VSIX artifact is downloaded to dist-langtailor/.

$ErrorActionPreference = "Stop"

$VsixDir = Join-Path $PSScriptRoot "..\..\dist-langtailor"
$VsixFiles = Get-ChildItem -Path $VsixDir -Filter "*.vsix"
if (-not $VsixFiles) { throw "No .vsix found in $VsixDir" }

Write-Host "Using VSIX files:"
$VsixFiles | ForEach-Object { Write-Host "  $($_.FullName)" }

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/VSCodium/vscodium/releases/latest"
$asset = $release.assets | Where-Object { $_.name -match "^VSCodium-win32-x64-.+\.zip$" } | Select-Object -First 1
if (-not $asset) { throw "VSCodium Windows x64 portable zip not found in latest release" }

Write-Host "Downloading $($asset.name) ..."
$zipPath = Join-Path $env:RUNNER_TEMP "vscodium.zip"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

$extractRoot = Join-Path $env:RUNNER_TEMP "vscodium-extract"
if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
Expand-Archive -Path $zipPath -DestinationPath $extractRoot

$vscodiumRoot = $extractRoot
$codium = Join-Path $vscodiumRoot "bin\codium.cmd"
if (-not (Test-Path $codium)) {
  $nested = Get-ChildItem -Path $extractRoot -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "bin\codium.cmd")
  } | Select-Object -First 1
  if ($nested) {
    $vscodiumRoot = $nested.FullName
    $codium = Join-Path $vscodiumRoot "bin\codium.cmd"
  }
}
if (-not (Test-Path $codium)) { throw "codium.cmd not found under $extractRoot" }

$extensionsDir = Join-Path $vscodiumRoot "resources\app\extensions"
if (-not (Test-Path $extensionsDir)) { New-Item -ItemType Directory -Path $extensionsDir -Force | Out-Null }

function Install-BuiltInExtension {
  param([string]$VsixPath)
  $tempDir = Join-Path $env:RUNNER_TEMP ("vsix-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
  try {
    Expand-Archive -Path $VsixPath -DestinationPath $tempDir -Force
    $manifestPath = Join-Path $tempDir "extension\package.json"
    if (-not (Test-Path $manifestPath)) { throw "Invalid VSIX: no extension/package.json in $VsixPath" }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $extId = $manifest.name
    $dest = Join-Path $extensionsDir $extId
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Path (Join-Path $tempDir "extension") -Destination $dest -Recurse
    Write-Host "Installed built-in extension: $extId -> $dest"
  } finally {
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
  }
}

Write-Host "Installing extensions as built-in into $extensionsDir ..."
foreach ($Vsix in $VsixFiles) {
  Install-BuiltInExtension -VsixPath $Vsix.FullName
}

$outZip = Join-Path $env:GITHUB_WORKSPACE "LangTailor-win-x64-portable.zip"
if (Test-Path $outZip) { Remove-Item -Force $outZip }
Compress-Archive -Path $vscodiumRoot -DestinationPath $outZip -CompressionLevel Optimal

Write-Host "Created $outZip ($((Get-Item $outZip).Length) bytes)"
