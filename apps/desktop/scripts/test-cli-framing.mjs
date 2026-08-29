/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const workDir = await mkdtemp(join(tmpdir(), "diffusion-cli-framing-"));
const bundle = join(workDir, "cli-handshake.cjs");

try {
  await build({
    entryPoints: [join(desktopDir, "src", "cli-handshake.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundle,
  });
  const { createHandshakeFrameReader } = createRequire(import.meta.url)(bundle);

  const read = (chunks, end) => {
    const frames = [];
    const reader = createHandshakeFrameReader((raw) => frames.push(raw));
    for (const chunk of chunks) reader.push(chunk);
    if (end) reader.end();
    return frames;
  };

  const newline = read(['{"port":1,', '"token":"new"}\nignored'], true);
  const legacy = read(['{"port":2,', '"token":"legacy"}'], true);
  if (newline.length !== 1 || JSON.parse(newline[0]).token !== "new") {
    throw new Error(`Newline framing failed: ${JSON.stringify(newline)}`);
  }
  if (legacy.length !== 1 || JSON.parse(legacy[0]).token !== "legacy") {
    throw new Error(`Legacy EOF framing failed: ${JSON.stringify(legacy)}`);
  }
  console.log(`cli-framing: passed newline and legacy EOF on ${process.platform}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
