# Windows validation

This document is the source of truth for the Windows port. A row is `PASS` only
when the named workflow has run on native Windows and the evidence column names
the command, artifact, or report that proves it. Static review and successful
TypeScript compilation are not runtime evidence.

Upstream base: `aeb873bfc6c239a05821c9af307fca34a06e8928`

Status values: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, or `UPSTREAM FAILURE`.

## Build and packaging

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| Supported Node version is installed | NOT RUN | Record `node --version` and `npm --version` in `artifacts/windows-validation.json`. |
| Clean `npm ci` succeeds | NOT RUN | Native Windows command log and CI job. |
| `apps/web/.env` is prepared from `.env.example` | NOT RUN | Validation script/report; `.env` must remain uncommitted. |
| `npm run check` succeeds | NOT RUN | Native Windows command log and CI job. |
| `npm run lint` succeeds | NOT RUN | Native Windows command log and CI job, or a documented unrelated upstream failure. |
| CLI bundle builds in PowerShell/cmd | NOT RUN | `npm run build --workspace=@diffusionstudio/cli`. |
| Desktop main/preload/native build succeeds | NOT RUN | `npm run build --workspace=@diffusionstudio/desktop`. |
| Top-level `npm run dev` starts Vite and Electron | NOT RUN | Smoke log plus app screenshot. |
| Ctrl+C stops the complete development process tree | NOT RUN | Port/process check after orchestrator shutdown. |
| Windows packaging command succeeds | NOT RUN | `npm run make:windows` and package paths in the report. |
| Installer/distributable contains app, web, CLI, docs, dependencies, and icon | NOT RUN | Package inspection and packaged smoke test. |

## Desktop application

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| App launches and main window renders | NOT RUN | Desktop screenshot and logs. |
| Native Windows title bar can move, minimize, maximize, restore, and close | NOT RUN | Native GUI smoke record. |
| Fullscreen enters and exits | NOT RUN | Native GUI smoke record and renderer state. |
| App exits normally | NOT RUN | Process exit record. |
| Second instance surfaces the first instance | NOT RUN | Instance/process/window record. |
| `diffusion://` registration does not crash | NOT RUN | Packaged launch/protocol record. |
| Auth and checkout deep links route from initial and second-instance argv | NOT RUN | Automated deep-link tests or native smoke evidence. |
| Default projects folder works | NOT RUN | Project creation record. |
| Folder picker works | NOT RUN | Native GUI smoke record. |
| OneDrive/cloud-folder warning logic does not crash | NOT RUN | Targeted native test. |
| Project creation and opening work | NOT RUN | Deterministic project smoke test. |
| Project compilation works | NOT RUN | Context/log evidence. |
| UI/source edits persist | NOT RUN | Before/after source plus recapture evidence. |
| Recursive file watching recompiles a changed project | NOT RUN | Changed source, logs, and changed capture. |
| Unpackaged app does not initialize auto-update | NOT RUN | Development logs. |
| Packaged app starts without updater failure | NOT RUN | Packaged logs. |

## CLI and desktop transport

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| `dapi --help` | NOT RUN | Native command output. |
| Newline-framed handshake works over `\\.\pipe\diffusion-studio` | NOT RUN | Automated transport test plus real CLI round trip. |
| Legacy half-close framing remains accepted on Unix | NOT RUN | Automated server framing test or macOS CI/check. |
| `dapi context` | NOT RUN | End-to-end report. |
| `dapi open` cold-launches the packaged app | NOT RUN | Process/socket/project evidence. |
| `dapi open --background` does not raise the window | NOT RUN | Native window-state evidence. |
| `dapi open` surfaces a running app | NOT RUN | Native window-state evidence. |
| `dapi screenshot` | NOT RUN | Non-empty PNG path and dimensions. |
| `dapi logs` | NOT RUN | Log output with no fatal errors. |
| `dapi media probe` | NOT RUN | JSON metadata for rendered media. |
| `dapi media grab` | NOT RUN | Non-empty PNG output. |
| `dapi media filmstrip` | NOT RUN | Non-empty PNG output. |
| `dapi media waveform` | NOT RUN | Non-empty PNG output from deterministic audio/video. |
| `dapi capture` | NOT RUN | Start and midpoint PNGs. |
| `dapi check` | NOT RUN | Structural JSON with no error-severity issues. |
| Render/export workflow | NOT RUN | Non-empty, non-zero-duration output plus probe. |
| `dapi fonts` | NOT RUN | Windows families/variants and filtering output. |
| Packaged `dapi.cmd` works without a separate Node installation | NOT RUN | Packaged smoke command and launcher inspection. |
| In-app per-user CLI installation is deterministic and reversible | NOT RUN | Install/uninstall and user-PATH record. |

## Mandatory deterministic agent workflow

The validation project must be created in a temporary directory and contain a
1920x1080 scene, solid background, visible text, at least one animated
property, and a duration between three and five seconds. Do not commit the
rendered media.

| Step | Status | Evidence |
| --- | --- | --- |
| Launch Diffusion Studio | NOT RUN | Report process/window fields. |
| Open the project with `dapi open` | NOT RUN | CLI JSON and context. |
| Query context | NOT RUN | CLI JSON. |
| Capture start and midpoint frames | NOT RUN | Two non-empty PNGs. |
| Inspect captures | NOT RUN | Dimensions and visual review notes. |
| Run structural check | NOT RUN | Check JSON. |
| Edit a visible property in project source | NOT RUN | Before/after values. |
| Observe file-watch recompile and changed capture | NOT RUN | Log/capture evidence. |
| Render/export the short video | NOT RUN | Output path and byte size. |
| Probe and confirm non-zero duration | NOT RUN | Probe JSON. |
| Exercise media grab, filmstrip, and waveform | NOT RUN | Output paths and sizes. |
| Capture the application window | NOT RUN | Screenshot path and dimensions. |
| Read logs and confirm no fatal error | NOT RUN | Filtered logs. |

The machine-readable result is `artifacts/windows-validation.json`. It must
include the upstream base SHA, commit SHA, Windows version, architecture, Node
and npm versions, command exit codes, artifact names and sizes, media duration,
and any limitations. Generated captures, screenshots, media, package outputs,
and `.env` files remain uncommitted.

## CI and macOS regression protection

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| `windows-latest` installs, checks, lints, builds, packages, and uploads maker output | NOT RUN | GitHub Actions run URL and artifact name. |
| CI requires no signing secret | NOT RUN | Workflow review and successful fork run. |
| Existing macOS makers and release job remain configured | NOT RUN | Forge/workflow review. |
| macOS-only native addon is skipped on Windows | NOT RUN | Native Windows build log. |
| macOS window/menu/wrapper/deep-link paths remain intact | NOT RUN | Check/build plus platform review. |

## Completion rule

The port is complete only when all severe blockers are resolved and every
mandatory row is `PASS`. Any remaining unvalidated release-signing or public
distribution requirement must be stated as a limitation; it cannot be silently
treated as passed.
