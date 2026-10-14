/**
 * Writes the packaged extension icons (public/icon/<size>.png) from the
 * mascot sprite. WXT picks them up for `icons` and `action.default_icon`.
 *
 * Run with `npm run icons` after changing src/mascot/sprite.ts; a unit test
 * fails if the committed PNGs are out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { encodePng } from '../src/mascot/png.ts';
import { ICON_EXPRESSION, ICON_SIZES, iconLook, rasterize } from '../src/mascot/sprite.ts';

const outDir = path.resolve(import.meta.dirname, '../public/icon');
mkdirSync(outDir, { recursive: true });
for (const size of ICON_SIZES) {
  const file = path.join(outDir, `${String(size)}.png`);
  writeFileSync(file, encodePng(rasterize(ICON_EXPRESSION, size, iconLook(size)), size, size));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
