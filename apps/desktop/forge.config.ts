/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
const [releaseOwner, releaseName] = (
  process.env.DIFFUSION_GITHUB_REPOSITORY ??
  process.env.GITHUB_REPOSITORY ??
  'diffusionstudio/editor'
).split('/');

if (!releaseOwner || !releaseName) {
  throw new Error('DIFFUSION_GITHUB_REPOSITORY must use the owner/repository form');
}

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Diffusion Studio',
    appBundleId: 'studio.diffusion.editor',
    appCategoryType: 'public.app-category.video',
    appVersion: version,
    icon: './assets/icon',
    protocols: [{ name: 'Diffusion Studio', schemes: ['diffusion'] }],
    prune: false,
    ignore: (path) =>
      path !== '' &&
      path !== '/package.json' &&
      path !== '/dist' &&
      !path.startsWith('/dist/') &&
      path !== '/web' &&
      !path.startsWith('/web/'),
    // Staged by scripts/stage-cli.mjs and stage-docs.mjs; end up at
    // Contents/Resources/{cli,docs}.
    extraResource: ['./cli', './docs'],
    osxSign: process.env.SKIP_SIGN ? undefined : {},
    osxNotarize:
      process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID
        ? {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          }
        : undefined,
  },
  makers: [
    new MakerSquirrel(
      {
        name: 'diffusion_studio',
        authors: 'Diffusion Studio Inc.',
        description: 'The professional video editor built for agents',
        setupExe: `Diffusion-Studio-${process.arch}-Setup.exe`,
        setupIcon: './assets/icon.ico',
        noMsi: true,
      },
      ['win32'],
    ),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: `Diffusion-Studio-${process.arch}`,
      icon: './assets/icon.icns',
      // Dark, on-brand window; @2x sibling is picked up automatically for retina.
      background: './assets/dmg-background.png',
      iconSize: 120,
      additionalDMGOptions: {
        'background-color': '#1c1c1c',
        window: { size: { width: 658, height: 498 } },
      },
      contents: (opts) => [
        { x: 188, y: 217, type: 'file', path: opts.appPath },
        { x: 470, y: 217, type: 'link', path: '/Applications' },
      ],
    }),
  ],
  publishers: [
    new PublisherGithub({
      // GitHub Actions supplies GITHUB_REPOSITORY, so a fork publishes only
      // to itself. Local/upstream release behavior keeps the original default.
      repository: { owner: releaseOwner, name: releaseName },
      draft: true,
    }),
  ],
};

export default config;
