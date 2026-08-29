/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MAIN_CHANNELS } from "./main-channels";
import type { DeepLinkChannel } from "./main-channels";

export const APP_PROTOCOL = "diffusion";

/** The first protocol URL Electron delivered in initial or second-instance argv. */
export function findProtocolUrl(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`)) ?? null;
}

/** Routes only supported callback hosts; unknown deep links are ignored. */
export function deepLinkChannel(url: string): DeepLinkChannel | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (host === "auth") return MAIN_CHANNELS.AUTH_CALLBACK;
  if (host === "checkout") return MAIN_CHANNELS.CHECKOUT_CALLBACK;
  return null;
}

