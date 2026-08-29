/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const APP_NAME = "Diffusion Studio";

function windowsExecutable(): string | null {
  const configured = process.env.DIFFUSION_APP_PATH;
  if (configured && existsSync(configured)) return configured;

  // A packaged dapi launcher runs the app's Electron executable in Node mode.
  // That executable is also the most reliable way to cold-launch its GUI.
  if (process.env.ELECTRON_RUN_AS_NODE === "1" && basename(process.execPath).toLowerCase() !== "node.exe") {
    return process.execPath;
  }

  // Development installs made by Squirrel keep versions below one stable
  // per-user root. This fallback lets a separately linked development CLI
  // locate the newest installed application as well.
  const local = process.env.LOCALAPPDATA;
  if (!local) return null;
  for (const name of ["diffusion_studio", "diffusion-studio", "DiffusionStudio", "Diffusion Studio"]) {
    const root = join(local, name);
    if (!existsSync(root)) continue;
    const versions = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("app-"))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const version of versions) {
      const candidate = join(root, version, `${APP_NAME}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function spawnDetached(executable: string, args: string[]): Promise<boolean> {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      detached: true,
      stdio: "ignore",
      env,
    });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

/** Cold-launches the installed desktop application. */
export async function launchDesktopApp(background: boolean): Promise<boolean> {
  if (process.platform === "darwin") {
    const args = background ? ["-g", "-a", APP_NAME, "--args", "--hidden"] : ["-a", APP_NAME];
    return new Promise((resolve) => execFile("open", args, (error) => resolve(!error)));
  }

  if (process.platform === "win32") {
    const executable = windowsExecutable();
    if (!executable) return false;
    return spawnDetached(executable, background ? ["--hidden"] : []);
  }

  return false;
}
