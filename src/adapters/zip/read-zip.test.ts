import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readZip } from './read-zip';

/** Writes a small zip (stored or deflated entries) for tests. */
function makeZip(entries: { path: string; text: string; deflate?: boolean }[]): ArrayBuffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.path);
    const raw = Buffer.from(e.text);
    const data = e.deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, dir, eocd]);
  return new Uint8Array(all).buffer;
}

describe('readZip', () => {
  it('reads stored and deflated .tex and .bib files and skips the rest', async () => {
    const zip = makeZip([
      { path: 'main.tex', text: '\\documentclass{article}' },
      { path: 'sections/intro.tex', text: '\\section{Introduction} ü'.repeat(50), deflate: true },
      { path: 'refs.bib', text: '@article{a,}', deflate: true },
      { path: 'figure.png', text: 'binary' },
      { path: '__MACOSX/main.tex', text: 'junk' },
    ]);
    const files = await readZip(zip);
    expect(files.map((f) => f.path)).toEqual(['main.tex', 'sections/intro.tex', 'refs.bib']);
    expect(files[1]?.text.startsWith('\\section{Introduction} ü')).toBe(true);
  });

  it('enforces size limits and rejects non-zips', async () => {
    const zip = makeZip([{ path: 'big.tex', text: 'x'.repeat(2000) }]);
    await expect(readZip(zip, { maxFileBytes: 1000 })).resolves.toEqual([]);
    await expect(readZip(new ArrayBuffer(100))).rejects.toThrow('Not a zip');
  });
});
