/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(cliDir, "dist", "index.js");
const socketPath = process.platform === "win32"
  ? "\\\\.\\pipe\\diffusion-studio"
  : join(tmpdir(), "diffusion-studio.sock");

if (process.platform !== "win32") rmSync(socketPath, { force: true });

let sawNewline = false;
let sawContextRequest = false;
const server = createServer({ allowHalfOpen: true }, (socket) => {
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    const newline = buffer.indexOf("\n");
    if (newline === -1) return;
    sawNewline = true;
    const { port, token } = JSON.parse(buffer.slice(0, newline));
    socket.end('{"ok":true}\n');

    const renderer = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`);
    renderer.on("message", (raw) => {
      const request = JSON.parse(raw.toString());
      if (request.path !== "context") throw new Error(`Unexpected request path: ${request.path}`);
      sawContextRequest = true;
      renderer.send(JSON.stringify({
        ok: true,
        data: { root: null, project: null, playhead: 0, fontFamilies: [], generations: [] },
      }));
      renderer.close();
    });
  });
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(socketPath, resolve);
});

const result = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [bundle, "context"], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  child.once("error", reject);
  child.once("exit", (code) => resolve({ code, stdout, stderr }));
});

await new Promise((resolve) => server.close(resolve));
if (process.platform !== "win32") rmSync(socketPath, { force: true });

if (result.code !== 0) throw new Error(`dapi context failed (${result.code}): ${result.stderr}`);
if (!sawNewline) throw new Error("Client did not newline-frame its named-pipe handshake");
if (!sawContextRequest) throw new Error("Fake renderer did not receive the context request");
JSON.parse(result.stdout.trim());
console.log(`handshake: passed on ${process.platform} (${socketPath})`);

