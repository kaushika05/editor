/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { toast } from "somoto";

import { track } from "@/lib/analytics";

const MACOS_DOWNLOAD_URL =
  import.meta.env.VITE_MACOS_DOWNLOAD_URL?.trim() ||
  "https://github.com/diffusionstudio/editor/releases/latest/download/Diffusion-Studio-arm64.dmg";

// Forks and self-hosted deployments can point at their own signed release.
// There is deliberately no default Windows URL until that deployment has
// actually published an installer.
const WINDOWS_DOWNLOAD_URL = import.meta.env.VITE_WINDOWS_DOWNLOAD_URL?.trim() || null;

/** Where a download was started from, so the promos can be compared. */
export type DesktopAppDownloadSource = "canvas_banner" | "dashboard_footer" | "main_menu";

export type DesktopPlatform = "macos" | "windows" | "other";

export function desktopPlatform(): DesktopPlatform {
  const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform;
  if (/win/i.test(platform)) return "windows";
  if (/mac/i.test(platform)) return "macos";
  return "other";
}

export function desktopAppDownloadLabel(): string {
  const platform = desktopPlatform();
  if (platform === "windows") return "Download for Windows";
  if (platform === "macos") return "Download for macOS";
  return "Get desktop app";
}

/**
 * Pulls the latest DMG. GitHub serves the asset with `Content-Disposition:
 * attachment`, so this starts a download rather than navigating away.
 *
 * The promos run on every platform to gauge interest, but there is only a
 * macOS build to hand out — everywhere else this explains that instead.
 */
export function downloadDesktopApp(source: DesktopAppDownloadSource) {
  const platform = desktopPlatform();
  const url = platform === "macos" ? MACOS_DOWNLOAD_URL : platform === "windows" ? WINDOWS_DOWNLOAD_URL : null;
  const supported = url !== null;
  track("desktop_app_download", { source, platform, supported });

  if (!url) {
    toast(platform === "windows" ? "Windows installer is not published here" : "Desktop download unavailable", {
      description: platform === "windows"
        ? "This deployment supports a configurable Windows release URL. Build the installer from the repository or ask the deployment owner to publish one."
        : "Use macOS or Windows, or build the desktop application from source.",
    });
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
