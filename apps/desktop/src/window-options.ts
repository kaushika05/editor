/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { BrowserWindowConstructorOptions } from "electron";

export function mainWindowOptions(preload: string): BrowserWindowConstructorOptions {
  const shared: BrowserWindowConstructorOptions = {
    show: false,
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: { preload },
  };

  if (process.platform === "darwin") {
    return {
      ...shared,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 14 },
      vibrancy: "sidebar",
      backgroundColor: "#00000000",
    };
  }

  // Windows and Linux use their ordinary native frame. The renderer does not
  // implement window drag/minimize/maximize controls, so hiding this frame
  // would strand users with macOS-specific chrome.
  return {
    ...shared,
    titleBarStyle: "default",
    backgroundColor: "#1c1c1c",
  };
}

