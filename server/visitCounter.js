const fs = require('fs');
const path = require('path');

/** CapRover: Persistent Directory → Path in App: `/app/data` (Has Persistent Data włączone). */
const DATA_DIR = process.env.VISIT_DATA_DIR
  ? path.resolve(process.env.VISIT_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'visits.json');
const INITIAL_COUNT = 0;
const FLUSH_DEBOUNCE_MS = 2000;
const DISK_SYNC_INTERVAL_MS = 12000;
const isProd = process.env.NODE_ENV === 'production';

/** @type {{ count: number, version: number, updatedAt: number }} */
const cache = {
  count: INITIAL_COUNT,
  version: 0,
  updatedAt: Date.now(),
};

let dirty = false;
let flushTimer = null;
let lastDiskMtime = 0;
let lastDiskSyncAt = 0;

const ensureDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const bumpCache = () => {
  cache.version += 1;
  cache.updatedAt = Date.now();
};

const load = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (typeof raw.count === 'number' && Number.isFinite(raw.count) && raw.count >= 0) {
        cache.count = Math.floor(raw.count);
        bumpCache();
        lastDiskMtime = fs.statSync(DATA_FILE).mtimeMs;
        return;
      }
    }
    cache.count = INITIAL_COUNT;
  } catch {
    cache.count = INITIAL_COUNT;
  }
};

const maybeSyncFromDisk = () => {
  if (dirty) return;
  const now = Date.now();
  if (now - lastDiskSyncAt < DISK_SYNC_INTERVAL_MS) return;
  lastDiskSyncAt = now;

  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const stat = fs.statSync(DATA_FILE);
    if (stat.mtimeMs <= lastDiskMtime) return;

    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (typeof raw.count !== 'number' || !Number.isFinite(raw.count) || raw.count < 0) return;

    const diskCount = Math.floor(raw.count);
    lastDiskMtime = stat.mtimeMs;
    if (diskCount !== cache.count) {
      cache.count = diskCount;
      bumpCache();
    }
  } catch {
    /* ignore */
  }
};

const flush = () => {
  if (!dirty) return;
  dirty = false;
  try {
    ensureDir();
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ count: cache.count }), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    lastDiskMtime = fs.statSync(DATA_FILE).mtimeMs;
  } catch {
    dirty = true;
    scheduleFlush();
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DEBOUNCE_MS);
};

const getSnapshot = () => {
  maybeSyncFromDisk();
  return {
    count: cache.count,
    version: cache.version,
    updatedAt: cache.updatedAt,
  };
};

const recordVisit = () => {
  cache.count += 1;
  bumpCache();
  dirty = true;
  scheduleFlush();
  return getSnapshot();
};

load();

if (isProd) {
  console.log(`[visits] storage: ${DATA_FILE} (loaded count: ${cache.count})`);
}

const shutdown = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flush();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

module.exports = {
  getSnapshot,
  recordVisit,
  flush,
  INITIAL_COUNT,
  /** @deprecated use getSnapshot */
  getCount: () => getSnapshot().count,
};
