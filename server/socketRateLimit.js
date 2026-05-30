/**
 * Luźny rate limiter in-memory dla Socket.io (anty-flood / anty-DDoS).
 * Nie blokuje normalnego użycia w LAN (wiele kart, WebRTC signaling).
 */

const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

/** @param {{ max: number, windowMs: number }} opts */
const createSlidingWindow = ({ max, windowMs }) => {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  const pruneKey = (key, now = Date.now()) => {
    const arr = hits.get(key);
    if (!arr) return;
    const cutoff = now - windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
    if (!arr.length) hits.delete(key);
  };

  const allow = (key) => {
    const id = key || 'unknown';
    const now = Date.now();
    pruneKey(id, now);
    const arr = hits.get(id) || [];
    if (arr.length >= max) return false;
    arr.push(now);
    hits.set(id, arr);
    return true;
  };

  const pruneAll = () => {
    for (const key of [...hits.keys()]) pruneKey(key);
  };

  return { allow, pruneAll };
};

// Nowe połączenia z jednego IP (np. odświeżenia, kilka urządzeń w WiFi)
const connectionByIp = createSlidingWindow({ max: 40, windowMs: 60_000 });

// WebRTC signaling — dość wysoki limit
const signalBySocket = createSlidingWindow({ max: 200, windowMs: 10_000 });
const signalByIp = createSlidingWindow({ max: 500, windowMs: 10_000 });

// Zapytania o połączenie z peerem
const requestBySocket = createSlidingWindow({ max: 25, windowMs: 60_000 });

// register_name / register_device
const miscBySocket = createSlidingWindow({ max: 50, windowMs: 60_000 });

const limiters = [
  connectionByIp,
  signalBySocket,
  signalByIp,
  requestBySocket,
  miscBySocket,
];

const pruneTimer = setInterval(() => {
  for (const limiter of limiters) limiter.pruneAll();
}, PRUNE_INTERVAL_MS);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

const normalizeIp = (ip) => String(ip || 'unknown').slice(0, 64);

const allowConnection = (ip) => connectionByIp.allow(normalizeIp(ip));

const allowSignal = (socketId, ip) =>
  signalBySocket.allow(socketId) && signalByIp.allow(normalizeIp(ip));

const allowRequestConnection = (socketId) => requestBySocket.allow(socketId);

const allowMisc = (socketId) => miscBySocket.allow(socketId);

module.exports = {
  /** Maks. równoległych socketów z jednego IP (poza sliding window). */
  MAX_CONCURRENT_PER_IP: 30,
  allowConnection,
  allowSignal,
  allowRequestConnection,
  allowMisc,
};
