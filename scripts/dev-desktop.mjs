/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// One command to develop the desktop app from source. It builds the CLI,
// starts Vite, waits for it, builds Electron, launches the app, and owns the
// complete process tree so Ctrl+C shuts everything down on every platform.

import { execFileSync, spawn } from "node:child_process";
import { get } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = join(ROOT, "node_modules", ".bin");
const DEV_PORT = 5173;
const DEV_URL = `http://localhost:${DEV_PORT}`;
const WINDOWS = process.platform === "win32";
const children = [];
let shuttingDown = false;

function tool(name) {
  return join(BIN, WINDOWS ? `${name}.cmd` : name);
}

function run(name, bin, args, cwd) {
  const child = spawn(tool(bin), args, {
    cwd,
    stdio: "inherit",
    detached: !WINDOWS,
    shell: WINDOWS,
    windowsHide: true,
  });
  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`\n[dev:desktop] failed to start ${name}: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n[dev:desktop] ${name} exited (${code}); shutting down.`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function stopTree(pid, force = false) {
  if (!pid) return;
  try {
    if (WINDOWS) {
      execFileSync("taskkill.exe", ["/PID", String(pid), "/T", ...(force ? ["/F"] : [])], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      process.kill(-pid, force ? "SIGKILL" : "SIGTERM");
    }
  } catch {
    // The process was already gone.
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopTree(child.pid, WINDOWS);
  process.exit(code);
}

function runNpm(args) {
  execFileSync(WINDOWS ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    shell: WINDOWS,
    windowsHide: true,
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.once("error", () => {
        req.destroy();
        if (Date.now() > deadline) reject(new Error(`Vite did not come up at ${url} in time`));
        else setTimeout(tryOnce, 200);
      });
    };
    tryOnce();
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

function windowsListeners(port) {
  try {
    const out = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (!match) continue;
      const local = match[1];
      if (Number(local?.slice(local.lastIndexOf(":") + 1)) === port) pids.add(Number(match[2]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

/** PIDs listening on a TCP port; [] when none or the platform query fails. */
function listeners(port) {
  if (WINDOWS) return windowsListeners(port);
  try {
    const out = execFileSync("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.toString().split("\n").map((line) => Number(line.trim())).filter(Boolean);
  } catch {
    return [];
  }
}

/** The command line of a process, or an empty string when it is gone. */
function commandOf(pid) {
  try {
    if (WINDOWS) {
      const script = `Get-CimInstance Win32_Process -Filter \"ProcessId = ${Number(pid)}\" | Select-Object -ExpandProperty CommandLine`;
      return execFileSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", windowsHide: true },
      ).trim();
    }
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
  } catch {
    return "";
  }
}

function belongsToThisVite(command) {
  const normalized = command.replaceAll("\\", "/").toLowerCase();
  const root = ROOT.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  return normalized.includes("vite") && normalized.includes(root);
}

/**
 * Frees the dev port only when every listener is a Vite process from this
 * checkout. An unrelated listener is reported and never terminated.
 */
async function reclaimPort(port) {
  const pids = listeners(port);
  if (!pids.length) return;
  for (const pid of pids) {
    const command = commandOf(pid);
    if (!belongsToThisVite(command)) {
      throw new Error(`port ${port} is in use by another process (pid ${pid}): ${command || "unknown"}`);
    }
    console.log(`[dev:desktop] port ${port} held by a stale vite (pid ${pid}); stopping it…`);
    stopTree(pid);
  }

  const deadline = Date.now() + 5000;
  while (listeners(port).length) {
    if (Date.now() > deadline) {
      for (const pid of listeners(port)) stopTree(pid, true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

console.log("[dev:desktop] building CLI…");
runNpm(["run", "build", "--workspace=@diffusionstudio/cli"]);

try {
  await reclaimPort(DEV_PORT);
} catch (error) {
  console.error(`[dev:desktop] ${error.message}`);
  process.exit(1);
}
console.log("[dev:desktop] starting web dev server…");
run("web", "vite", ["--strictPort"], join(ROOT, "apps", "web"));

try {
  await waitForServer(DEV_URL);
} catch (error) {
  console.error(`[dev:desktop] ${error.message}`);
  shutdown(1);
}

console.log("[dev:desktop] building desktop app…");
runNpm(["run", "build", "--workspace=@diffusionstudio/desktop"]);
console.log("[dev:desktop] starting desktop app…");
run("desktop", "electron-forge", ["start"], join(ROOT, "apps", "desktop"));
