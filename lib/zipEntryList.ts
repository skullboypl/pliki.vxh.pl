/** List ZIP entries from central directory only (no inflate / extract). */

export type ZipEntryInfo = {
  path: string;
  uncompressedSize: number;
  compressedSize: number;
};

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const TAIL_READ_BYTES = 65536 + 22;
const MAX_CENTRAL_DIR_BYTES = 32 * 1024 * 1024;
const MAX_LISTED_ENTRIES = 5000;

function u16(buf: Uint8Array, o: number) {
  return buf[o]! | (buf[o + 1]! << 8);
}

function u32(buf: Uint8Array, o: number) {
  return (buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16) | (buf[o + 3]! << 24)) >>> 0;
}

function findEocdOffset(buf: Uint8Array): number {
  const start = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= start; i--) {
    if (u32(buf, i) === EOCD_SIG) return i;
  }
  return -1;
}

function parseCentralDirectory(cd: Uint8Array): ZipEntryInfo[] {
  const entries: ZipEntryInfo[] = [];
  let pos = 0;
  while (pos + 46 <= cd.length && entries.length < MAX_LISTED_ENTRIES) {
    if (u32(cd, pos) !== CDFH_SIG) break;
    const uncompSize = u32(cd, pos + 24);
    const compSize = u32(cd, pos + 20);
    const nameLen = u16(cd, pos + 28);
    const extraLen = u16(cd, pos + 30);
    const commentLen = u16(cd, pos + 32);
    const nameStart = pos + 46;
    if (nameStart + nameLen > cd.length) break;
    const name = new TextDecoder().decode(cd.subarray(nameStart, nameStart + nameLen));
    if (name && !name.endsWith('/')) {
      entries.push({
        path: name.replace(/\\/g, '/'),
        uncompressedSize: uncompSize,
        compressedSize: compSize,
      });
    }
    pos = nameStart + nameLen + extraLen + commentLen;
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));
  return entries;
}

async function readByteRange(
  url: string,
  start: number,
  endInclusive: number,
): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
  });
  if (res.status === 206 || res.ok) {
    return new Uint8Array(await res.arrayBuffer());
  }
  const full = await fetch(url);
  if (!full.ok) throw new Error('fetch failed');
  const all = new Uint8Array(await full.arrayBuffer());
  return all.subarray(start, Math.min(all.length, endInclusive + 1));
}

async function resolveSize(
  source: Blob | File | string,
  knownSize?: number,
): Promise<number> {
  if (knownSize && knownSize > 0) return knownSize;
  if (typeof source !== 'string') return source.size;
  const head = await fetch(source, { method: 'HEAD' });
  const len = head.headers.get('Content-Length');
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const res = await fetch(source);
  if (!res.ok) throw new Error('fetch failed');
  const blob = await res.blob();
  return blob.size;
}

async function readTail(source: Blob | File | string, totalSize: number): Promise<Uint8Array> {
  const start = Math.max(0, totalSize - TAIL_READ_BYTES);
  if (typeof source !== 'string') {
    const slice = source.slice(start, totalSize);
    return new Uint8Array(await slice.arrayBuffer());
  }
  return readByteRange(source, start, totalSize - 1);
}

async function readCentralDirectory(
  source: Blob | File | string,
  cdOffset: number,
  cdSize: number,
): Promise<Uint8Array> {
  if (cdSize > MAX_CENTRAL_DIR_BYTES) {
    throw new Error('ZIP central directory too large');
  }
  const end = cdOffset + cdSize - 1;
  if (typeof source !== 'string') {
    const slice = source.slice(cdOffset, cdOffset + cdSize);
    return new Uint8Array(await slice.arrayBuffer());
  }
  return readByteRange(source, cdOffset, end);
}

export function isZipArchiveName(fileName: string, mime = ''): boolean {
  const mt = mime.toLowerCase();
  if (mt === 'application/zip' || mt === 'application/x-zip-compressed') return true;
  return /\.zip$/i.test(fileName);
}

export async function listZipEntries(
  source: Blob | File | string,
  knownSize?: number,
): Promise<ZipEntryInfo[]> {
  const totalSize = await resolveSize(source, knownSize);
  if (totalSize < 22) throw new Error('invalid ZIP');

  const tail = await readTail(source, totalSize);
  const eocdAt = findEocdOffset(tail);
  if (eocdAt < 0) throw new Error('ZIP end record not found');

  const eocd = tail.subarray(eocdAt);
  const entryCount = u16(eocd, 10);
  const cdSize = u32(eocd, 12);
  const cdOffset = u32(eocd, 16);

  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 not supported for listing');
  }
  if (!cdSize) return [];

  const cd = await readCentralDirectory(source, cdOffset, cdSize);
  return parseCentralDirectory(cd);
}
