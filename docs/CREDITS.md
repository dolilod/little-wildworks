# Credits — The Little Wildworks

## Game design and assets

Game design and assets: The Little Wildworks asset pack (original, made for this family project).
That covers the design brief, the eight creatures and the Keeper (GLB models), the island and project
toys (world kit), the ground tiles, the 12 UI icons, the title logo, the seven synthesized sound cues,
and the authored data (creatures, world, palette). No franchise or third-party art was imported.

Files shipped from the pack (unchanged unless noted):

- `assets/models/*.glb` — nine procedural glTF 2.0 models (keeper + 8 creatures).
- `assets/textures/{meadow,pond,dusk}-tile.png` — 512 × 512 repeating ground tiles (SVG renders).
- `assets/ui/*.svg` — 12 icons (4 elements, 5 items, 3 controls).
- `assets/brand/title.svg` — outlined title wordmark (see font notice below).
- `data/creatures.json`, `data/world.json`, `data/palette.json`.
- `js/kit/creature-factory.js`, `js/kit/world-kit.js` — unchanged.
- `js/kit/sound-kit.js` — one addition: a `graph()` accessor so the game's extra synth layers share the
  kit's audio context and mute. The seven original cues are unchanged.

- `assets/concept/*-concept.jpg` — the pack's nine image-tool character turnaround sheets
  (`assets/turnarounds/*-concept.png`), downscaled to 560 px wide JPEGs for the Credits screen only.
  They load only when Credits is opened.

The roster, memory book and friend button use portraits rendered at runtime from the real 3D models, so
no concept image is part of the gameplay download.

## Code

Game code (everything in `js/` except `js/kit/`) written by the build agent for this family project,
following the asset pack's brief. All sound beyond the seven kit cues (footsteps, creature voices,
ambience, picnic music) is synthesized at runtime with WebAudio; no audio files are shipped.

## Three.js

Three.js r180 (`vendor/three/three.module.min.js`, `vendor/three/three.core.min.js`,
`vendor/three/addons/loaders/GLTFLoader.js`, `vendor/three/addons/utils/BufferGeometryUtils.js`),
MIT License, Copyright © 2010-2025 three.js authors. The full license text is in
`vendor/three/LICENSE` (unmodified copy from the npm package three@0.180.0).

## Skill-pack note

Design and engineering guidance came from a game-development skill pack (Apache-2.0), used as
read-only reference material. No files from it are included in this game.

## Pack provenance notes (from the asset pack's docs/third-party-notices.md, kept intact)

> # Third-party notices
>
> ## Three.js 0.180.0
>
> Three.js is declared as a pinned dependency in `package.json`. Its distribution is not vendored in this pack. Validation used the official npm package for this exact version. When packaging a browser build containing Three.js, retain its license notice.
>
> Project: https://threejs.org/
>
> Package inspected: https://registry.npmjs.org/three/-/three-0.180.0.tgz
>
> The following is the unmodified license supplied by that package:
>
> ```text
> The MIT License
> 
> Copyright © 2010-2025 three.js authors
> 
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
> 
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
> 
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
> ```

## Font notice for the title wordmark (from the pack's docs/vector-assets.md)

The logo's letters are outlined paths derived from DejaVu Sans Bold. No font file is shipped.
DejaVu changes are in the public domain. Bitstream Vera notice:

Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved.
Bitstream Vera is a trademark of Bitstream, Inc.
DejaVu changes are in public domain.

Permission is hereby granted, free of charge, to any person obtaining a copy of the fonts accompanying this license ("Fonts") and associated documentation files (the "Font Software"), to reproduce and distribute the Font Software, including without limitation the rights to use, copy, merge, publish, distribute, and/or sell copies of the Font Software, and to permit persons to whom the Font Software is furnished to do so, subject to the following conditions:

The above copyright and trademark notices and this permission notice shall be included in all copies of one or more of the Font Software typefaces.

The Font Software may be modified, altered, or added to, and in particular the designs of glyphs or characters in the Fonts may be modified and additional glyphs or characters may be added to the Fonts, only if the fonts are renamed to names not containing either the words "Bitstream" or the word "Vera".

This License becomes null and void to the extent applicable to Fonts or Font Software that has been modified and is distributed under the "Bitstream Vera" names.

The Font Software may be sold as part of a larger software package but no copy of one or more of the Font Software typefaces may be sold by itself.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL BITSTREAM OR THE GNOME FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

Except as contained in this notice, the names of Gnome, the Gnome Foundation, and Bitstream Inc., shall not be used in advertising or otherwise to promote the sale, use or other dealings in this Font Software without prior written authorization from the Gnome Foundation or Bitstream Inc., respectively. For further information, contact: fonts at gnome dot org.

## Thank you

Made by a dad, for his son, and for everyone who helps a tiny creature try a big idea.
