# MotionEase — build a signed .zxp for distribution.
#
# Requires Adobe's ZXPSignCmd (free): https://github.com/Adobe-CEP/CEP-Resources
#   -> ZXPSignCMD/  (download the .exe, put it on PATH or pass -SignCmd)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File build-zxp.ps1
#   powershell -ExecutionPolicy Bypass -File build-zxp.ps1 -SignCmd "C:\tools\ZXPSignCmd.exe"
#
# First run creates a self-signed cert (cert.p12). A self-signed .zxp installs
# fine via ZXP installer tools; for the Adobe Exchange store you need a real cert.

param(
    [string]$SignCmd  = "ZXPSignCmd",
    [string]$Password = "motionease",
    [string]$Org      = "AIGeoLab",
    [string]$CommonName = "MotionEase by Fahad Akash"
)

$ErrorActionPreference = "Stop"
$root  = $PSScriptRoot
$dist  = Join-Path $root "dist"
$stage = Join-Path ([System.IO.Path]::GetTempPath()) "motionease-zxp-stage"
$cert  = Join-Path $root "cert.p12"
$zxp   = Join-Path $dist "MotionEase-1.0.zxp"

# resolve ZXPSignCmd
$cmd = (Get-Command $SignCmd -ErrorAction SilentlyContinue).Source
if (-not $cmd) {
    if (Test-Path $SignCmd) { $cmd = $SignCmd }
    else {
        Write-Error "ZXPSignCmd not found. Download it from Adobe-CEP/CEP-Resources (ZXPSignCMD) and put it on PATH, or pass -SignCmd 'C:\path\ZXPSignCmd.exe'."
        exit 1
    }
}
Write-Host "Using ZXPSignCmd: $cmd" -ForegroundColor Cyan

# stage a clean copy of ONLY the extension (no installers / .debug / docs)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($item in @("CSXS", "client", "host")) {
    Copy-Item (Join-Path $root $item) $stage -Recurse -Force
}

# self-signed certificate (created once)
if (-not (Test-Path $cert)) {
    Write-Host "Creating self-signed certificate cert.p12 ..." -ForegroundColor Yellow
    & $cmd -selfSignedCert US CA $Org $CommonName $Password $cert
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $zxp) { Remove-Item $zxp -Force }

Write-Host "Signing .zxp ..." -ForegroundColor Yellow
& $cmd -sign $stage $zxp $cert $Password -tsa "http://timestamp.digicert.com"

Remove-Item $stage -Recurse -Force
if (Test-Path $zxp) {
    Write-Host "[ok] Built: $zxp" -ForegroundColor Green
    Write-Host "Share this .zxp. Recipients install it with ZXPInstaller or Anastasiy's Extension Manager."
} else {
    Write-Error "Signing failed - see ZXPSignCmd output above."
}
