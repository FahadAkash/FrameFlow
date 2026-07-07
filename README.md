# FrameFlow — a real graph editor for Premiere Pro

**An After Effects–style value & speed graph, dropped right into Premiere Pro.**
Bend the bezier, drop it on anything keyframeable, and get motion that actually moves.

*Made by **Fahad Akash** · v1.0 · Premiere Pro 2022+ · Windows & macOS*

---

## Why this exists

Premiere never gave you a real graph editor. So your motion looks stiff:

- **"Ease In / Ease Out" is a lie** — two presets and a vague influence % you can't see.
- **You're guessing the curve** — dragging keyframe handles blind, scrubbing back, nudging again.
- **AE round-trips kill you** — the one app with a real graph editor is a *whole other app*.

FrameFlow puts a **draggable bezier curve** right in Premiere. You shape the interpolation,
the motion responds live, and one click bakes that exact curve onto your keyframes — Position,
Scale, Rotation, Opacity, or any keyframed effect property.

---

## What it is (and how it runs)

FrameFlow is a **CEP panel** — the same extension technology every Premiere/After Effects
panel uses. It runs **inside** Premiere Pro (Window → Extensions), **not** in a web browser.

- The UI (`client/`) is HTML/CSS/JS because Premiere renders panels in an embedded Chromium.
- A small ExtendScript host (`host/FrameFlow.jsx`) is what actually reads and writes your keyframes.

The two talk over CEP's `evalScript` bridge.

---

## Features

- **Editable value graph** — draggable bezier handles on a real value curve. No more guessing what "33% influence" means.
- **Speed / velocity graph** — flip to the Speed view to shape *how fast* the value moves through time (accelerate, coast, decelerate). It's the same ease, seen as velocity.
- **Apply to many properties at once** — tick Position / Scale / Rotation / Opacity; Apply bakes the same curve into all of them.
- **Works on effects too** — the *"Also ease keyframed effect properties"* toggle eases any parameter with 2+ keyframes, including the **Transform** effect and third-party plugins with custom parameter names.
- **Per-property keyframe status** — a live dot on each property: 🟢 has keyframes · ⚪ keyframeable but none yet · ⭕ not on this clip.
- **Two apply modes** — **Smooth** (a full, error-bounded set of keyframes) and **Minimal** (only a few), with a keyframe-count stepper.
- **Smooth keyframes** — every baked keyframe is set to **Bezier** interpolation automatically.
- **Undo / Restore** — a one-click ↺ Undo (and Ctrl/Cmd+Z) restores properties to before the last Apply. Full history, up to 25 steps.
- **Preset library** — built-in eases (Ease In/Out, Overshoot, Anticipate, Snap…) plus save your own.
- **Live preview** — a looping preview of your current ease on each property type.
- **Responsive, themed UI** with tooltips on everything.

---

## How it applies the curve (the important part)

After Effects lets a tool set a keyframe's exact **temporal ease** (`setTemporalEaseAtKey`
with speed + influence) — that's how AE tools like *Flow* shape a curve with just your two
keyframes. **Premiere's scripting API has no equivalent** — there is no way to script keyframe
influence. This is a hard platform limitation, not a bug.

So FrameFlow does the one thing that *does* reproduce an exact curve in Premiere: it **bakes
keyframes** that sample your curve. The result is the exact value graph you drew — including
overshoot and anticipation — on any keyframeable property.

To keep that tidy and reliable, the baker:

- **Samples adaptively** — it places keyframes only where the curve bends (recursive
  subdivision with an error bound), so a flat stretch gets ~3 keys and a sharp ease gets more.
  **Minimal** mode caps this low; **Smooth** mode allows more for higher fidelity.
- **Never deletes your keyframes** — it keeps your two endpoint keyframes and only adds points
  *between* them (and removes its own previously-baked interior keys on re-apply). Your originals
  can't be lost.
- **Scopes to the playhead's segment** — it eases the pair of keyframes the **playhead sits
  between**, so a clip with several animations keeps them independent. Move the playhead into the
  segment you want, then Apply.
- **Sets Bezier interpolation** on every baked keyframe so the motion is smooth.
- **Handles Premiere's time formats** — keyframe times come back as ticks or seconds depending
  on the version; FrameFlow detects and matches the format so writes always land.

---

## Install (for development / your own machine)

1. Make sure you have the whole `FrameFlow` folder (`CSXS/`, `client/`, `host/`).
2. **Windows** — right-click **`install-windows.ps1`** → *Run with PowerShell*
   (or `powershell -ExecutionPolicy Bypass -File install-windows.ps1`).
   **macOS** — `chmod +x install-mac.command`, then double-click it.
3. **Fully quit and relaunch** Premiere Pro.
4. **Window → Extensions → FrameFlow Graph Editor.**

The installer enables CEP *debug mode* (required to load an unsigned panel) and copies the
extension into your per-user Adobe CEP folder:

- Windows: `%APPDATA%\Adobe\CEP\extensions\com.aigeolab.frameflow`
- macOS: `~/Library/Application Support/Adobe/CEP/extensions/com.aigeolab.frameflow`

> **Giving it to other people?** See **[DISTRIBUTION.md](DISTRIBUTION.md)** — build a shareable
> ZIP (`build-zip.ps1`) or a signed `.zxp` (`build-zxp.ps1`).

---

## Using it

1. **Add 2+ keyframes** to a property on your clip (e.g. Position — click the ⏱ stopwatch,
   move the playhead, change the value). Two keyframes is enough.
2. **Select the clip.** The panel shows "1 clip selected" and the property dots light up for
   whatever is keyframed.
3. **Move the playhead between the two keyframes** you want to ease. (This is how FrameFlow
   knows which segment to affect.)
4. **Shape the curve** — drag the two handles. Hold **Shift** for free movement past 0–1
   (overshoot / anticipation). Or click a **preset**.
5. Tick the **properties** to affect (or **All**), and optionally *"Also ease keyframed effect
   properties"* for Transform / third-party effects.
6. Choose **Smooth** or **Minimal**, then **Apply to selection.**
7. Not happy? **↺ Undo** (or **Ctrl/Cmd+Z**) restores it. Save the curve as a **preset** for next time.

### Value vs Speed
Two views of the same ease. **Value** = value over time (the shape). **Speed** = velocity over
time (how fast it moves at each moment). Editing either changes the same handles.

---

## Project structure

```
FrameFlow/
├─ CSXS/
│  └─ manifest.xml          CEP manifest (host app, panel size, entry points)
├─ client/                  the panel UI (runs in Premiere's Chromium)
│  ├─ index.html
│  ├─ css/style.css         dark theme, responsive layout
│  └─ js/
│     ├─ CSInterface.js     CEP <-> host bridge (compact build)
│     ├─ bezier.js          cubic-bezier eval + adaptive/velocity sampling
│     ├─ presets.js         built-in + user presets (localStorage)
│     ├─ graph.js           the interactive canvas graph editor
│     └─ main.js            panel controller, Apply, Undo, polling
├─ host/
│  ├─ FrameFlow.jsx        ExtendScript: reads + bakes keyframes, undo, scan
│  └─ lib/json2.jsx         JSON polyfill for the ExtendScript engine
├─ .debug                   remote-debug ports (dev only)
├─ install-windows.ps1      installer (enables debug mode + copies)
├─ install-mac.command
├─ build-zip.ps1            package a shareable ZIP
├─ build-zxp.ps1            sign a distributable .zxp
├─ DISTRIBUTION.md          how to ship it to others
└─ README.md
```

### Host API (called from the panel via `evalScript`)
- `FrameFlow.ping()` → version string
- `FrameFlow.scanSelection()` → JSON: per-property keyframe status + effects that hold keyframes
- `FrameFlow.apply(payloadJson)` → bakes the curve; returns `{ ok, applied, message, details }`
- `FrameFlow.restoreLast()` → undo the last Apply
- `FrameFlow.undoCount()` → history depth (to sync the Undo button)

---

## Development / debugging

With debug mode on (the installer sets it), open **http://localhost:8088** in Chrome while the
panel is loaded in Premiere to get full DevTools (console, breakpoints) for the panel UI. The
port is defined in `.debug`.

To iterate on the ExtendScript host, edit `host/FrameFlow.jsx`, re-run the installer to copy it,
then reopen the panel (host is re-evaluated when the panel loads).

---

## Known limitations

- **No scripted keyframe influence.** Premiere's API can't set temporal ease influence like AE,
  so FrameFlow bakes keyframes rather than using two "influenced" keyframes. This is inherent to
  Premiere, not a limitation of the tool.
- **Playhead picks the segment.** Because the API can't report *which* keyframes you selected,
  the playhead position chooses the segment to ease. Put it between the two keyframes you mean.
- **Version-sensitive scripting.** Keyframe time format (ticks vs seconds) and interpolation
  constants vary across Premiere versions; the host is written defensively and auto-detects where
  it can. Targets Premiere Pro 2022+.

---

## Roadmap ideas

- Spatial (motion-path) easing, not just temporal.
- Copy/paste an ease between clips.
- Export/import preset packs.
- Signed release on Adobe Exchange.

---

## Credits

**FrameFlow** — designed and built by **Fahad Akash**.
Bundle id `com.aigeolab.frameflow`. Built as an Adobe CEP extension.
