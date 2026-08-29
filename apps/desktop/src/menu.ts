/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { app, dialog, Menu } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { installCli, uninstallCli } from "./cli-install";

async function showCliInstall() {
  try {
    const detail = await installCli();
    await dialog.showMessageBox({
      type: "info",
      message: "The dapi command line tool was installed.",
      detail,
    });
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (message.includes("-128")) return; // user cancelled the admin prompt
    await dialog.showMessageBox({
      type: "error",
      message: "Could not install the dapi command line tool.",
      detail: message,
    });
  }
}

async function showCliUninstall() {
  try {
    const detail = await uninstallCli();
    await dialog.showMessageBox({
      type: "info",
      message: "The dapi command line tool was removed.",
      detail,
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      message: "Could not remove the dapi command line tool.",
      detail: (error as Error).message,
    });
  }
}

export function setupAppMenu() {
  const macTemplate: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Install dapi Command Line Tool…",
          enabled: app.isPackaged,
          click: showCliInstall,
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];

  const windowsTemplate: MenuItemConstructorOptions[] = [
    {
      label: "&File",
      submenu: [
        {
          label: "Install dapi Command Line Tool…",
          enabled: app.isPackaged,
          click: showCliInstall,
        },
        {
          label: "Uninstall dapi Command Line Tool…",
          enabled: app.isPackaged,
          click: showCliUninstall,
        },
        { type: "separator" },
        { role: "close" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    { role: "help", submenu: [{ role: "about" }] },
  ];

  const template = process.platform === "darwin" ? macTemplate : windowsTemplate;
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
