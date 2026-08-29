/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { isScene } from "@diffusionstudio/runtime";
import { ElectronWritableFileHandle } from "@/lib/electron-file-writable";
import { renderScene } from "@/context/render";
import { resolveNode } from "./nodes";

import type { RenderRequest, RenderResult } from "@diffusionstudio/cli/channels";
import type { EditorSession } from "./session";

export function handleRender(session: () => EditorSession) {
  return async ({ id, path, format = "mp4", video, audio }: RenderRequest): Promise<RenderResult> => {
    const { world, project, engine } = session();
    const scene = resolveNode(world, id);
    if (!isScene(scene)) throw new Error(`"${id}" is not a scene — render takes a scene id.`);

    const target = new ElectronWritableFileHandle(path);
    try {
      const result = await renderScene(engine, {
        scene,
        target,
        config: { format, video, audio },
        dir: project.dir(),
      });
      if (result.type === "canceled") throw new Error("Render canceled");
      if (result.type === "error") throw result.error;
      return { path, format };
    } finally {
      await target.dispose();
    }
  };
}

