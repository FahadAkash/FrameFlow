# FrameFlow — Windows installer
# 1) Enables CEP "debug mode" so an unsigned panel is allowed to load.
# 2) Copies this extension into the per-user Adobe CEP extensions folder.
#
# Run:  right-click > "Run with PowerShell"
#   or:  powershell -ExecutionPolicy Bypass -File install-windows.ps1

$ErrorActionPreference = "Stop"
$bundleId = "com.aigeolab.frameflow"
$source   = $PSScriptRoot
$dest     = Join-Path $env:APPDATA "Adobe\CEP\extensions\$bundleId"

Write-Host "FrameFlow installer" -ForegroundColor Cyan
Write-Host "--------------------"

# --- 1. Enable PlayerDebugMode for every CEP runtime Premiere might use ------
foreach ($v in 6..12) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    New-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $key -Name "LogLevel" -Value "1" -PropertyType String -Force | Out-Null
}
Write-Host "[ok] CEP debug mode enabled (CSXS.6 - CSXS.12)" -ForegroundColor Green

# --- 2. Copy the extension ---------------------------------------------------
if (Test-Path $dest) {
    Remove-Item $dest -Recurse -Force
}
New-Item -ItemType Directory -Path $dest -Force | Out-Null

Copy-Item (Join-Path $source "CSXS")   $dest -Recurse -Force
Copy-Item (Join-Path $source "client") $dest -Recurse -Force
Copy-Item (Join-Path $source "host")   $dest -Recurse -Force
if (Test-Path (Join-Path $source ".debug")) {
    Copy-Item (Join-Path $source ".debug") $dest -Force
}

Write-Host "[ok] Installed to:" -ForegroundColor Green
Write-Host "     $dest"
Write-Host ""
Write-Host "Now fully quit Premiere Pro and relaunch it." -ForegroundColor Yellow
Write-Host "Open the panel:  Window > Extensions > FrameFlow Graph Editor"
