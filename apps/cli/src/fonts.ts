/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { spawnSync } from "node:child_process";
import { platform } from "node:os";

export type FontVariant = {
  weight: string;
  style: "normal" | "italic";
  source: string;
};

export type FontFamily = {
  family: string;
  variants: FontVariant[];
};

// JXA script that walks every registered font family via NSFontManager and
// emits each variant's CSS-style weight, italic flag, and CSS `local()` source.
// Embedded inline so the CLI binary is self-contained — runs via `osascript`.
const LIST_FONTS_JXA = `
ObjC.import("AppKit");

function nsfmWeightToCss(w) {
  if (w <= 1) return "100";
  if (w <= 2) return "200";
  if (w <= 3) return "300";
  if (w <= 5) return "400";
  if (w <= 6) return "500";
  if (w <= 8) return "600";
  if (w <= 9) return "700";
  if (w <= 11) return "800";
  return "900";
}

function run() {
  var fm = $.NSFontManager.sharedFontManager;
  var families = fm.availableFontFamilies;
  var out = [];
  for (var i = 0; i < families.count; i++) {
    var family = ObjC.unwrap(families.objectAtIndex(i));
    if (family.charAt(0) === ".") continue;
    var members = fm.availableMembersOfFontFamily(family);
    if (!members || members.isNil()) continue;
    var variants = [];
    for (var j = 0; j < members.count; j++) {
      var m = members.objectAtIndex(j);
      var fontName = ObjC.unwrap(m.objectAtIndex(0));
      var styleName = ObjC.unwrap(m.objectAtIndex(1));
      var weight = ObjC.unwrap(m.objectAtIndex(2));
      var traits = ObjC.unwrap(m.objectAtIndex(3));
      var fullName = styleName === "Regular" ? family : family + " " + styleName;
      variants.push({
        weight: nsfmWeightToCss(weight),
        style: (traits & 1) !== 0 ? "italic" : "normal",
        source: "local('" + fullName + "'), local('" + fontName + "')",
      });
    }
    if (variants.length > 0) out.push({ family: family, variants: variants });
  }
  return JSON.stringify(out);
}
`;

const WINDOWS_FONT_KEYS = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
  "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
];

function cssQuote(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function fontWeight(name: string): string {
  if (/\b(?:thin|hairline)\b/i.test(name)) return "100";
  if (/\b(?:extra|ultra)[ -]?light\b/i.test(name)) return "200";
  if (/\b(?:semi[ -]?light|light)\b/i.test(name)) return "300";
  if (/\bmedium\b/i.test(name)) return "500";
  if (/\b(?:semi|demi)[ -]?bold\b/i.test(name)) return "600";
  if (/\b(?:extra|ultra)[ -]?bold\b/i.test(name)) return "800";
  if (/\b(?:black|heavy)\b/i.test(name)) return "900";
  if (/\bbold\b/i.test(name)) return "700";
  return "400";
}

const STYLE_SUFFIX = new RegExp(
  String.raw`(?:[ -]+(?:thin|hairline|extra[ -]?light|ultra[ -]?light|semi[ -]?light|light|regular|normal|medium|semi[ -]?bold|demi[ -]?bold|extra[ -]?bold|ultra[ -]?bold|bold|black|heavy|italic|oblique))+$`,
  "i",
);

function windowsFamilyName(fullName: string): string {
  return fullName.replace(STYLE_SUFFIX, "").trim() || fullName;
}

function parseWindowsRegistry(stdout: string): Array<{ name: string; file: string }> {
  const fonts: Array<{ name: string; file: string }> = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(.+?)\s{2,}REG_(?:EXPAND_)?SZ\s{2,}(.+?)\s*$/i);
    if (!match) continue;
    const name = match[1]!.replace(/\s+\((?:TrueType|OpenType|All res)\)$/i, "").trim();
    if (name && match[2]) fonts.push({ name, file: match[2].trim() });
  }
  return fonts;
}

function listWindowsFonts(): FontFamily[] {
  const registered: Array<{ name: string; file: string }> = [];
  for (const key of WINDOWS_FONT_KEYS) {
    const result = spawnSync("reg.exe", ["query", key], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.status === 0) registered.push(...parseWindowsRegistry(result.stdout));
  }

  if (registered.length === 0) throw new Error("Failed to enumerate fonts from the Windows registry.");

  const families = new Map<string, FontVariant[]>();
  const seen = new Set<string>();
  for (const entry of registered) {
    // Collections commonly register several face names in one value.
    for (const fullName of entry.name.split(/\s*&\s*/)) {
      const family = windowsFamilyName(fullName);
      const variant: FontVariant = {
        weight: fontWeight(fullName),
        style: /\b(?:italic|oblique)\b/i.test(fullName) ? "italic" : "normal",
        source: `local('${cssQuote(fullName)}')`,
      };
      const key = `${family.toLowerCase()}\0${variant.weight}\0${variant.style}\0${entry.file.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const variants = families.get(family) ?? [];
      variants.push(variant);
      families.set(family, variants);
    }
  }

  return [...families]
    .map(([family, variants]) => ({
      family,
      variants: variants.sort((a, b) => Number(a.weight) - Number(b.weight) || a.style.localeCompare(b.style)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

export type ListLocalFontsOptions = {
  familyPattern?: string;
  weights?: string[];
  style?: "normal" | "italic";
  limit?: number;
};

export function listLocalFonts(options: ListLocalFontsOptions = {}): FontFamily[] {
  let all: FontFamily[];
  if (platform() === "darwin") {
    const result = spawnSync("osascript", ["-l", "JavaScript", "-e", LIST_FONTS_JXA], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || "Failed to enumerate fonts.");
    }
    all = JSON.parse(result.stdout.trim()) as FontFamily[];
  } else if (platform() === "win32") {
    all = listWindowsFonts();
  } else {
    throw new Error("fonts is only supported on macOS and Windows.");
  }
  const pattern = options.familyPattern?.toLowerCase();
  const weights = options.weights && options.weights.length > 0 ? new Set(options.weights) : null;
  const { style, limit } = options;

  const out: FontFamily[] = [];
  for (const family of all) {
    if (pattern && !family.family.toLowerCase().includes(pattern)) continue;
    const variants = family.variants.filter((v) => {
      if (weights && !weights.has(v.weight)) return false;
      if (style && v.style !== style) return false;
      return true;
    });
    if (variants.length === 0) continue;
    out.push({ family: family.family, variants });
    if (limit !== undefined && out.length >= limit) break;
  }
  return out;
}
