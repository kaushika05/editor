/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(tmpdir(), `diffusion-deep-links-${randomUUID()}.cjs`);

try {
  await build({
    entryPoints: [join(root, "src", "deep-links.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
  });
  const { APP_PROTOCOL, deepLinkChannel, findProtocolUrl } = createRequire(import.meta.url)(outfile);
  assert.equal(APP_PROTOCOL, "diffusion");
  assert.equal(findProtocolUrl(["Diffusion Studio.exe", "--hidden"]), null);
  assert.equal(
    findProtocolUrl(["Diffusion Studio.exe", "diffusion://auth/callback?code=abc"]),
    "diffusion://auth/callback?code=abc",
  );
  assert.equal(deepLinkChannel("diffusion://auth/callback?code=abc"), "auth:callback");
  assert.equal(deepLinkChannel("diffusion://checkout/callback?session=abc"), "checkout:callback");
  assert.equal(deepLinkChannel("diffusion://unknown/path"), null);
  assert.equal(deepLinkChannel("not a url"), null);
  console.log("deep-links: initial argv, second-instance argv, auth, and checkout routing passed");
} finally {
  rmSync(outfile, { force: true });
}

