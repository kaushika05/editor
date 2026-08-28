/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const action = process.argv[2];
if (action !== "create" && action !== "remove") {
  throw new Error("Usage: node scripts/link-cli.mjs <create|remove>");
}

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(cliDir, "dist", "index.js");

function queryUserPath() {
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

function setUserPath(value) {
  execFileSync(
    "reg.exe",
    ["add", "HKCU\\Environment", "/v", "Path", "/t", "REG_EXPAND_SZ", "/d", value, "/f"],
    { stdio: "ignore", windowsHide: true },
  );
}

function updateWindowsPath(binDir, add) {
  const entries = queryUserPath().split(";").map((value) => value.trim()).filter(Boolean);
  const key = binDir.toLowerCase();
  const kept = entries.filter((value) => value.replace(/[\\/]+$/, "").toLowerCase() !== key);
  if (add) kept.push(binDir);
  setUserPath(kept.join(";"));
}

if (process.platform === "win32") {
  const binDir = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Diffusion Studio", "dev-bin");
  const launcher = join(binDir, "dapi.cmd");
  if (action === "remove") {
    rmSync(launcher, { force: true });
    updateWindowsPath(binDir, false);
    console.log(`Removed ${launcher} from the user PATH. Open a new terminal to observe the change.`);
  } else {
    mkdirSync(binDir, { recursive: true });
    const escapeBatch = (value) => value.replaceAll("%", "%%");
    writeFileSync(
      launcher,
      `@echo off\r\n"${escapeBatch(process.execPath)}" "${escapeBatch(bundle)}" %*\r\n`,
    );
    updateWindowsPath(binDir, true);
    console.log(`Installed ${launcher} on the user PATH. Open a new terminal to use dapi.`);
  }
  process.exit(0);
}

const link = process.platform === "darwin"
  ? "/opt/homebrew/bin/dapi"
  : join(homedir(), ".local", "bin", "dapi");
if (action === "remove") {
  rmSync(link, { force: true });
  console.log(`Removed ${link}`);
} else {
  mkdirSync(dirname(link), { recursive: true });
  try {
    if (readlinkSync(link) === bundle) process.exit(0);
  } catch {
    rmSync(link, { force: true });
  }
  symlinkSync(bundle, link);
  chmodSync(bundle, 0o755);
  console.log(`Linked ${link} -> ${bundle}`);
}

