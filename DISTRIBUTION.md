# Distributing MotionEase to other users

There are two ways to give MotionEase to someone else. Pick based on how "official"
you want it to feel.

| | A. ZIP + installer | B. Signed `.zxp` |
|---|---|---|
| Setup for you | none | download ZXPSignCmd once |
| Install for them | unzip, run a script | double-click in an installer app |
| Enables "debug mode" | yes (installer does it) | no (signed) |
| Good for | testers, clients, quick sharing | polished release / Adobe Exchange |

---

## A. ZIP + installer (works today, no signing)

**Build it:**
```powershell
powershell -ExecutionPolicy Bypass -File build-zip.ps1
```
This creates **`dist\MotionEase-1.0.zip`**. Send that file to the user.

**They install it:**
1. Unzip `MotionEase-1.0.zip` anywhere.
2. **Windows** — right-click `install-windows.ps1` → *Run with PowerShell*
   (or `powershell -ExecutionPolicy Bypass -File install-windows.ps1`).
   **macOS** — in Terminal: `chmod +x install-mac.command` then double-click it.
3. Fully quit and relaunch Premiere Pro.
4. **Window → Extensions → MotionEase Graph Editor.**

The installer enables CEP *debug mode* (needed for an unsigned panel) and copies the
extension into their per-user Adobe CEP folder. That's the same thing we've been doing
on this machine.

---

## B. Signed `.zxp` (the professional way)

A signed `.zxp` installs with a friendly installer app and does **not** require debug
mode. You sign it once with Adobe's free command-line tool.

**One-time setup — get ZXPSignCmd:**
1. Download `ZXPSignCmd.exe` from Adobe's CEP resources:
   https://github.com/Adobe-CEP/CEP-Resources → the **ZXPSignCMD** folder.
2. Put it on your PATH (e.g. `C:\Windows`) or note its full path.

**Build it:**
```powershell
powershell -ExecutionPolicy Bypass -File build-zxp.ps1
# or, if it isn't on PATH:
powershell -ExecutionPolicy Bypass -File build-zxp.ps1 -SignCmd "C:\tools\ZXPSignCmd.exe"
```
- First run creates a self-signed certificate `cert.p12` (password `motionease` — change it
  in the script for a real release). Keep `cert.p12` safe and reuse it for future versions.
- Output: **`dist\MotionEase-1.0.zxp`**. Send that file.

**They install it** with any ZXP installer:
- **ZXPInstaller** (free, drag-and-drop) — https://zxpinstaller.com
- **Anastasiy's Extension Manager** (free) — https://install.anastasiy.com
- or Adobe's UPIA / ExManCmd command line.

> A **self-signed** `.zxp` works with those installers. To sell it on the **Adobe Exchange**
> marketplace you need a certificate from a real CA (Comodo/DigiCert), then re-sign with it.

---

## Bumping the version

When you release an update, raise the version in **three** places so users get the update:
- `CSXS/manifest.xml` → `ExtensionBundleVersion` and the `<Extension ... Version>`
- the hero badge / footer in `client/index.html`
- the output filenames in `build-zip.ps1` / `build-zxp.ps1`

Then rebuild and re-send.

---

## What NOT to ship
- `cert.p12` (your signing key — keep private)
- `dist/` build outputs (regenerate them)
- `.debug` is only meaningful for local development; it's harmless in a ZIP but the
  `build-zxp.ps1` script already leaves it out of signed builds.
