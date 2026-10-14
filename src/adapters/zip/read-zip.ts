/**
 * Minimal ZIP reader for importing an Overleaf project download ("Download
 * source") locally. Uses the browser's DecompressionStream; nothing leaves
 * the machine. Supports stored and deflated entries, which is what Overleaf
 * and common zip tools produce.
 */
export interface ZipText {
  path: string;
  text: string;
}

export interface ReadZipOptions {
  accept?: (path: string) => boolean;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(buffer: ArrayBuffer, opts: ReadZipOptions = {}): Promise<ZipText[]> {
  const accept = opts.accept ?? ((p: string) => /\.(?:tex|bib)$/i.test(p));
  const maxFile = opts.maxFileBytes ?? 5_000_000;
  const maxTotal = opts.maxTotalBytes ?? 40_000_000;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Not a zip file.');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');
  const out: ZipText[] = [];
  let total = 0;

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new Error('Corrupt zip directory.');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const path = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/^\.\//, '');
    p += 46 + nameLen + extraLen + commentLen;

    const encrypted = (flags & 1) !== 0;
    if (encrypted || path.endsWith('/') || path.startsWith('__MACOSX/') || !accept(path)) continue;
    if (size > maxFile || total + size > maxTotal) continue;
    if (view.getUint32(local, true) !== LOCAL) throw new Error('Corrupt zip entry.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + compSize);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else continue;
    total += data.byteLength;
    out.push({ path, text: decoder.decode(data) });
  }
  return out;
}
