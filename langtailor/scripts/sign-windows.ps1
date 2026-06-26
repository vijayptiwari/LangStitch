# Optional Authenticode signing for Windows LangTailor portable bundle.
param(
  [Parameter(Mandatory = $true)]
  [string]$BundleDir
)

$ErrorActionPreference = "Stop"

if ($env:LANGTAILOR_SIGNING_ENABLED -ne "true") {
  Write-Host "LANGTAILOR_SIGNING_ENABLED is not true — skipping Windows signing"
  return
}

if (-not $env:WINDOWS_CERTIFICATE_BASE64 -or -not $env:WINDOWS_CERTIFICATE_PASSWORD) {
  Write-Host "WINDOWS_CERTIFICATE_* secrets missing — skipping Windows signing"
  return
}

$pfxPath = Join-Path $env:RUNNER_TEMP "codesign.pfx"
[IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE_BASE64))

$signtool = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
  Where-Object { $_.FullName -match 'x64\\signtool\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1

if (-not $signtool) { throw "signtool.exe not found" }

$exes = Get-ChildItem -Path $BundleDir -Recurse -Include *.exe, *.dll |
  Where-Object { $_.FullName -notmatch '\\tools\\' }

foreach ($file in $exes) {
  Write-Host "Signing $($file.FullName)"
  & $signtool.FullName sign /fd SHA256 /f $pfxPath /p $env:WINDOWS_CERTIFICATE_PASSWORD /tr http://timestamp.digicert.com /td SHA256 $file.FullName
}

$outZip = Join-Path (Split-Path $BundleDir -Parent) "LangTailor-win-x64-portable-signed.zip"
if (Test-Path $outZip) { Remove-Item -Force $outZip }
Compress-Archive -Path $BundleDir -DestinationPath $outZip -CompressionLevel Optimal
Write-Host "Created signed bundle: $outZip"
