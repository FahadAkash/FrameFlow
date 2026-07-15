@echo off
:: FrameFlow — Windows Installer (double-click to run)
:: This batch file launches the PowerShell installer automatically.

echo.
echo  ==============================
echo   FrameFlow Plugin Installer
echo  ==============================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"

echo.
echo  ==============================
echo   Installation complete!
echo  ==============================
echo.
pause
