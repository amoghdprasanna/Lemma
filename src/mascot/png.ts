import { inflateSync } from 'node:zlib';

/**
 * Reads the size and RGBA pixels of a non-interlaced 8-bit RGBA PNG (what a
 * canvas writes). Node-only: used by the packaged-icon test.
 */
export function decodePng(png: Buffer): { width: number; height: number; rgba: Buffer } {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0)
        throw new Error('Only 8-bit, non-interlaced RGBA PNGs are supported');
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? (rgba[out + i - 4] ?? 0) : 0; // left
      const b = y > 0 ? (rgba[out - stride + i] ?? 0) : 0; // up
      const c = i >= 4 && y > 0 ? (rgba[out - stride + i - 4] ?? 0) : 0; // up-left
      const x = line[i] ?? 0;
      rgba[out + i] =
        (x +
          (filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? (a + b) >> 1
                : filter === 4
                  ? paeth(a, b, c)
                  : 0)) &
        0xff;
    }
  }
  return { width, height, rgba };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
