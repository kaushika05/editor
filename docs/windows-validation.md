# Windows validation

This is the source of truth for the Windows port. `PASS` means the workflow ran
on native Windows or on the named native GitHub Actions runner; compilation
alone is not treated as runtime proof. The detailed machine-readable evidence
is in `artifacts/windows-validation.json`.

- Upstream base: `aeb873bfc6c239a05821c9af307fca34a06e8928`
- Validated implementation: `3ae94339fe4e42891218fb41a80e1ed0c3e1661d`
- Native host: Windows 11 Home 10.0.26200 x64, Node 24.18.1, npm 11.16.0
- Windows CI: [run 33208736266](https://github.com/kaushika05/editor/actions/runs/33208736266)
- macOS regression CI: [run 33208736226](https://github.com/kaushika05/editor/actions/runs/33208736226)

## Build and packaging

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| Clean dependency install and environment preparation | PASS | Windows CI ran `npm ci` and prepared the web environment without committing `.env`. |
| Type checks | PASS | Native `npm run check` exited 0; Windows and macOS CI also passed. |
| Lint | PASS | Native `npm run lint` exited 0 with no errors; both CI jobs passed. |
| CLI and desktop builds from PowerShell | PASS | Workspace builds passed on the native host and Windows CI. |
| Top-level development command | PASS | `npm run dev` launched CLI, Vite, desktop builds, and Electron; Ctrl+C left no app processes or port listeners. |
| Windows package/make | PASS | `npm run make:windows` passed locally and in CI. |
| Conventional installer | PASS | CI produced `Diffusion-Studio-x64-Setup.exe` plus NuGet/RELEASES metadata. |
| Packaged contents | PASS | Executable, renderer, CLI launcher/bundle/runtime, docs, dependencies, and `.ico` were inspected in the artifact. |

## Desktop application

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| Launch, render, and normal exit | PASS | Packaged app launched to a rendered window and exited through native window input. |
| Move, minimize, maximize, restore, fullscreen, close | PASS | `npm run test:window` exercised every state on native Windows. |
| Second-instance behavior and foreground surfacing | PASS | Background and foreground open used one root PID; foreground open made the existing window visible. |
| Protocol registration and deep-link routing | PASS | HKCU protocol registration was observed; initial/second-instance auth, checkout, and unknown URL paths passed without a crash. |
| Default projects folder and project creation | PASS | A project was created through the dashboard under the Windows Videos root and moved to the workspace after validation. |
| Native folder picker | PASS | The packaged app opened `Choose projects folder`, selected a workspace directory, and displayed the returned absolute path in the dashboard. |
| OneDrive/cloud-folder warning | PASS | Windows OneDrive environment detection ran without a crash. |
| Create, open, compile, edit, persist, and watch | PASS | The deterministic project compiled, a visible source edit persisted, and the recursive watcher produced a changed capture. |
| Development and packaged updater startup | PASS | Development did not initialize updates; the unsigned packaged build started without updater failure. Live signed-update delivery remains a release-infrastructure limitation. |

## CLI and desktop transport

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| `dapi --help` | PASS | Source, packaged, and menu-installed launchers printed help from PowerShell. |
| Named-pipe handshake | PASS | Automated newline-framing test and real `dapi` round trips passed over `\\.\pipe\diffusion-studio`. |
| Legacy Unix EOF framing | PASS | Shared framing regression test passed on macOS CI. |
| `dapi context` and readiness | PASS | Context reported the mounted directory and `projectReady: true`. |
| `dapi open` cold launch/background/foreground | PASS | Packaged cold launch, compiled-scene wait, hidden background open, and existing-window surfacing all passed. |
| Screenshot and logs | PASS | Application screenshot was 1184x735; logs contained no fatal errors. |
| Media probe, grab, filmstrip, waveform | PASS | Rendered media metadata and non-empty inspection PNGs are recorded in the JSON report. |
| Capture and structural check | PASS | Start/midpoint/changed frames were non-empty; four expected nodes and zero error issues were reported. |
| Render/export | PASS | A 4.0107-second AVC/AAC MP4 rendered and was probed successfully. |
| Windows fonts | PASS | Families, weight/style variants, names-only, family, weight, style, and limit filters were exercised. |
| Packaged launcher without Node | PASS | `dapi.cmd` uses the packaged Electron executable with `ELECTRON_RUN_AS_NODE=1`. |
| In-app CLI install/uninstall | PASS | Actual File-menu commands installed the launcher/runtime and user PATH entry, ran `dapi --help`, then removed all three and restored the user PATH exactly. |

## Mandatory deterministic agent workflow

The temporary project used a 1920x1080 scene, solid background, visible text,
an animated rectangle position, four-second duration, and a four-second 440 Hz
audio asset. Generated media and captures remain uncommitted.

| Step | Status | Evidence |
| --- | --- | --- |
| Launch and open with `dapi open` | PASS | Cold launch and compiled project readiness passed. |
| Query context and structural check | PASS | Scene, shape, text, and audio nodes were present; zero error issues. |
| Capture start and midpoint frames | PASS | PNG sizes: 23,074 and 39,284 bytes. |
| Perform an edit and observe watch recompilation | PASS | Orange `Windows Ready` changed to green `Windows Native`; changed midpoint PNG was 38,291 bytes. |
| Render/export and probe | PASS | MP4 was 270,456 bytes, 4.0107 seconds, AVC 1280x720 at 30 fps with AAC stereo audio. |
| Inspect media | PASS | Grab, 213,425-byte filmstrip, and 154,089-byte waveform passed. |
| Screenshot and logs | PASS | Fresh immediate open showed the scene; logs recorded export completion and no fatal errors. |

## CI and macOS regression protection

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| Windows native CI | PASS | Windows Server 2025 runner installed, checked, linted, tested, built, packaged, and uploaded maker output without signing secrets. |
| Windows artifact | PASS | `diffusion-studio-windows-3ae94339fe4e42891218fb41a80e1ed0c3e1661d`; installer SHA-256 `3748f09f78c6f67e45e5bc2ca633ab214ea2fbe447bdf1099e0a87aa0fab93d0`. |
| macOS regression CI | PASS | macOS arm64 passed install, check, lint, Unix transport/framing, deep links, AppKit addon build, and unsigned packaging. |
| Existing macOS behavior retained | PASS | DMG/ZIP makers, native addon, hidden-inset window, menu, wrapper, release workflow, and `open-url` path remain platform-specific. |

## Remaining release-infrastructure limitations

- The CI installer is unsigned and can trigger SmartScreen. Public distribution
  requires a Windows code-signing certificate.
- Applying an update from a signed, published Windows release was not exercised
  because the fork has no signed release channel. Packaged updater startup is
  structurally validated.
- The web UI advertises Windows only when `VITE_WINDOWS_DOWNLOAD_URL` points to
  a real published artifact.
