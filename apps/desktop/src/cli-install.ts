/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app } from "electron";
import { execFile, execFileSync } from "node:child_process";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MACOS_CLI_LINK = "/usr/local/bin/dapi";

function escapeBatch(value: string): string {
  return value.replaceAll("%", "%%");
}

function windowsBinDir(): string {
  const local = process.env.LOCALAPPDATA ?? join(app.getPath("home"), "AppData", "Local");
  return join(local, "Diffusion Studio", "bin");
}

function queryUserPath(): string {
  try {
    const out = execFileSync("reg.exe", ["query", "HKCU\\Environment", "/v", "Path"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return out.match(/^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.+)$/im)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function setUserPath(value: string): void {
  execFileSync(
    "reg.exe",
    ["add", "HKCU\\Environment", "/v", "Path", "/t", "REG_EXPAND_SZ", "/d", value, "/f"],
    { stdio: "ignore", windowsHide: true },
  );
}

function updateUserPath(binDir: string, add: boolean): void {
  const current = queryUserPath();
  const entries = current.split(";");
  const key = binDir.replace(/[\\/]+$/, "").toLowerCase();
  const matches = (entry: string) => entry.trim().replace(/[\\/]+$/, "").toLowerCase() === key;

  if (add) {
    if (!entries.some(matches)) setUserPath(current ? `${current};${binDir}` : binDir);
    return;
  }

  if (entries.some(matches)) setUserPath(entries.filter((entry) => !matches(entry)).join(";"));
}

async function installWindowsCli(): Promise<string> {
  const binDir = windowsBinDir();
  const runtime = join(binDir, "runtime");
  const launcher = join(binDir, "dapi.cmd");

  await mkdir(binDir, { recursive: true });
  await rm(runtime, { recursive: true, force: true });
  await cp(join(process.resourcesPath, "cli"), runtime, { recursive: true });

  const executable = escapeBatch(process.execPath);
  const bundle = escapeBatch(join(runtime, "dapi.js"));
  await writeFile(
    launcher,
    [
      "@echo off",
      "setlocal",
      `set "DIFFUSION_APP_PATH=${executable}"`,
      "set \"ELECTRON_RUN_AS_NODE=1\"",
      `"${executable}" "${bundle}" %*`,
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n"),
  );
  updateUserPath(binDir, true);
  return `Installed at ${launcher}. Open a new terminal before running \"dapi --help\".`;
}

async function uninstallWindowsCli(): Promise<string> {
  const binDir = windowsBinDir();
  await rm(join(binDir, "dapi.cmd"), { force: true });
  await rm(join(binDir, "runtime"), { recursive: true, force: true });
  updateUserPath(binDir, false);
  try {
    if ((await readdir(binDir)).length === 0) await rm(binDir, { recursive: true });
  } catch {
    // The directory was already absent.
  }
  return `Removed ${binDir} from the user PATH. Open a new terminal to observe the change.`;
}

function linkMacosCli(): Promise<string> {
  const wrapper = join(process.resourcesPath, "cli", "bin", "dapi");
  const shell = `mkdir -p /usr/local/bin && ln -sf '${wrapper}' '${MACOS_CLI_LINK}'`;
  const script = `do shell script "${shell.replaceAll('"', '\\"')}" with administrator privileges`;
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], (error) =>
      error
        ? reject(error)
        : resolve(`Linked at ${MACOS_CLI_LINK}. Run \"dapi --help\" in a terminal to get started.`),
    );
  });
}

export async function installCli(): Promise<string> {
  if (!app.isPackaged) throw new Error("Package the application before installing dapi.");
  if (process.platform === "darwin") return linkMacosCli();
  if (process.platform === "win32") return installWindowsCli();
  throw new Error("Automatic dapi installation is not supported on this platform.");
}

export async function uninstallCli(): Promise<string> {
  if (process.platform === "win32") return uninstallWindowsCli();
  throw new Error("Use the platform package manager to remove dapi on this platform.");
}
