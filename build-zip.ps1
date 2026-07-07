# FrameFlow — build a shareable ZIP (no signing required).
# Produces dist\FrameFlow-1.0.zip containing the extension + installers.
# Recipients unzip it and run install-windows.ps1 (or install-mac.command).

$ErrorActionPreference = "Stop"
$root  = $PSScriptRoot
$dist  = Join-Path $root "dist"
$stage = Join-Path ([System.IO.Path]::GetTempPath()) "FrameFlow"
$zip   = Join-Path $dist "FrameFlow-1.0.zip"

Write-Host "Packaging FrameFlow ZIP..." -ForegroundColor Cyan

# stage a clean 'FrameFlow' folder so the zip unpacks to a named folder
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$include = @("CSXS", "client", "host", ".debug",
             "install-windows.ps1", "install-mac.command", "README.md")
foreach ($item in $include) {
    $src = Join-Path $root $item
    if (Test-Path $src) { Copy-Item $src $stage -Recurse -Force }
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip

Remove-Item $stage -Recurse -Force
Write-Host "[ok] Built: $zip" -ForegroundColor Green
Write-Host "Share this file. The recipient unzips it and runs the installer inside."
