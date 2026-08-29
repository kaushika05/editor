/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

if (process.platform !== "win32") {
  console.log(`window-behavior: skipped on ${process.platform}`);
  process.exit(0);
}

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const workDir = await mkdtemp(join(tmpdir(), "diffusion-window-smoke-"));
const optionsBundle = join(workDir, "window-options.cjs");
const runner = join(workDir, "runner.cjs");
const preload = join(workDir, "preload.cjs");

const source = String.raw`
const { app, BrowserWindow } = require("electron");
const { mainWindowOptions } = require("./window-options.cjs");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const event = (emitter, name, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out waiting for " + name)), timeoutMs);
  emitter.once(name, (...args) => {
    clearTimeout(timer);
    resolve(args);
  });
});

async function transition(window, eventName, action) {
  const observed = event(window, eventName);
  action();
  await observed;
  await delay(100);
}

app.whenReady().then(async () => {
  const options = mainWindowOptions(require("node:path").join(__dirname, "preload.cjs"));
  const window = new BrowserWindow(options);
  await window.loadURL("data:text/html,<title>Window Smoke</title><main>Diffusion Studio Windows smoke</main>");
  window.show();
  await delay(150);

  const initial = window.getBounds();
  window.setBounds({ ...initial, x: initial.x + 24, y: initial.y + 24 });
  await delay(150);
  const moved = window.getBounds();

  await transition(window, "maximize", () => window.maximize());
  const maximized = window.isMaximized();
  await transition(window, "unmaximize", () => window.restore());
  const restoredFromMaximize = !window.isMaximized() && !window.isMinimized();

  await transition(window, "minimize", () => window.minimize());
  const minimized = window.isMinimized();
  await transition(window, "restore", () => window.restore());
  const restoredFromMinimize = !window.isMinimized();

  await transition(window, "enter-full-screen", () => window.setFullScreen(true));
  const fullscreen = window.isFullScreen();
  await transition(window, "leave-full-screen", () => window.setFullScreen(false));
  const leftFullscreen = !window.isFullScreen();

  const closed = event(window, "closed");
  window.close();
  await closed;

  const report = {
    platform: process.platform,
    nativeFrame: options.frame !== false && options.titleBarStyle === "default",
    visible: true,
    moved: moved.x === initial.x + 24 && moved.y === initial.y + 24,
    maximized,
    restoredFromMaximize,
    minimized,
    restoredFromMinimize,
    fullscreen,
    leftFullscreen,
    closed: window.isDestroyed(),
  };
  console.log(JSON.stringify(report));
  app.quit();
}).catch((error) => {
  console.error(error?.stack || String(error));
  app.exit(1);
});
`;

try {
  await build({
    entryPoints: [join(desktopDir, "src", "window-options.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: optionsBundle,
  });
  await writeFile(preload, "");
  await writeFile(runner, source);

  const electron = createRequire(import.meta.url)("electron");
  const result = await new Promise((resolve, reject) => {
    const child = spawn(electron, [runner], {
      cwd: workDir,
      windowsHide: true,
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });

  if (result.code !== 0) throw new Error(`Electron window smoke failed (${result.code}): ${result.stderr}`);
  const line = result.stdout.trim().split(/\r?\n/).findLast((entry) => entry.startsWith("{"));
  if (!line) throw new Error(`Electron window smoke produced no report: ${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(line);
  const failed = Object.entries(report)
    .filter(([key, value]) => key !== "platform" && value !== true)
    .map(([key]) => key);
  if (failed.length) throw new Error(`Electron window smoke failed checks: ${failed.join(", ")}`);
  console.log(`window-behavior: passed on ${report.platform} ${JSON.stringify(report)}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
