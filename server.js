const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const next = require('next');
const { Server } = require('socket.io');
const { generateNicknameSlug } = require('./shared/nicknames.js');
const visitCounter = require('./server/visitCounter');
const socketRateLimit = require('./server/socketRateLimit');
const { buildServiceWorkerScript } = require('./server/pwaServiceWorker');
const packageJson = require('./package.json');

const dev = process.env.NODE_ENV !== 'production';
const buildIdPath = path.join(__dirname, '.next', 'BUILD_ID');

const readBuildId = () => {
  try {
    return fs.readFileSync(buildIdPath, 'utf8').trim();
  } catch {
    return 'unknown';
  }
};

/** Unique per process — dev restart bumps fingerprint → one cache clear for stale tabs. */
const appBuildId = dev ? `dev-${Date.now().toString(36)}` : readBuildId();
const appVersion = packageJson.version;
const appFingerprint = `${appBuildId}@${appVersion}`;
process.env.APP_FINGERPRINT = appFingerprint;

if (!dev && !fs.existsSync(buildIdPath)) {
  console.error(
    '\n[share] Brak buildu Next.js (.next). Uruchom najpierw:\n  pnpm build\n  pnpm start\n',
  );
  process.exit(1);
}
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** @type {Map<string, { publicIp: string, name: string, device: string }>} */
const clients = new Map();

const DEVICE_KINDS = new Set(['desktop', 'iphone', 'ipad', 'android', 'mobile']);

const normalizeDevice = (value) => (DEVICE_KINDS.has(value) ? value : 'desktop');

const remoteIp = (socket) =>
  (socket.handshake.headers['x-real-ip'] ||
    socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    socket.handshake.address ||
    '')
    .replace(/^::ffff:/, '');

const groupKey = (ip) => ip;

const shortId = (socketId) => socketId.slice(-4).toUpperCase();

const namesInGroup = (publicIp) => {
  const used = new Set();
  for (const [, data] of clients.entries()) {
    if (data.publicIp === publicIp) used.add(data.name);
  }
  return used;
};

const broadcastPeers = (io) => {
  const groups = new Map();
  for (const [id, data] of clients.entries()) {
    const key = groupKey(data.publicIp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      id,
      name: data.name,
      shortId: shortId(id),
      device: normalizeDevice(data.device),
    });
  }
  for (const [id, data] of clients.entries()) {
    const list = groups.get(groupKey(data.publicIp))?.filter((p) => p.id !== id) || [];
    io.to(id).emit('local_peers_update', list);
  }
};

const countClientsFromIp = (publicIp) => {
  let n = 0;
  for (const [, data] of clients.entries()) {
    if (data.publicIp === publicIp) n += 1;
  }
  return n;
};

const attachSignaling = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const publicIp = remoteIp(socket);
    if (!socketRateLimit.allowConnection(publicIp)) {
      return next(new Error('rate_limited'));
    }
    if (countClientsFromIp(publicIp) >= socketRateLimit.MAX_CONCURRENT_PER_IP) {
      return next(new Error('too_many_connections'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const publicIp = remoteIp(socket);
    const name = generateNicknameSlug(namesInGroup(publicIp));
    clients.set(socket.id, { publicIp, name, device: 'desktop' });
    socket.emit('assigned_name', { name, shortId: shortId(socket.id) });
    broadcastPeers(io);

    socket.on('register_device', (device) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      if (clients.has(socket.id)) {
        clients.get(socket.id).device = normalizeDevice(device);
        broadcastPeers(io);
      }
    });

    socket.on('register_name', (rawName) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const trimmed = String(rawName || '').trim().substring(0, 24);
      if (trimmed && clients.has(socket.id)) {
        clients.get(socket.id).name = trimmed;
        broadcastPeers(io);
      }
    });

    socket.on('signal', ({ to, signal }) => {
      if (!socketRateLimit.allowSignal(socket.id, publicIp)) return;
      if (clients.has(to)) {
        io.to(to).emit('signal', { from: socket.id, signal });
      }
    });

    socket.on('request_connection', (targetId) => {
      if (!socketRateLimit.allowRequestConnection(socket.id)) return;
      if (clients.has(targetId)) {
        io.to(targetId).emit('incoming_connection_request', socket.id);
      }
    });

    socket.on('disconnect', () => {
      clients.delete(socket.id);
      io.emit('peer_disconnected', socket.id);
      broadcastPeers(io);
    });
  });

  return io;
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(body));
};

const handleVisitApi = (req, res) => {
  if (req.method === 'GET') {
    sendJson(res, 200, visitCounter.getSnapshot());
    return true;
  }
  if (req.method === 'POST') {
    sendJson(res, 200, visitCounter.recordVisit());
    return true;
  }
  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
};

const handleBuildIdApi = (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }
  sendJson(res, 200, {
    buildId: appBuildId,
    version: appVersion,
    fingerprint: appFingerprint,
  });
  return true;
};

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Surrogate-Control', 'no-store');
};

const LEGACY_SW_PATHS = new Set(['/sw.js', '/dev-sw.js', '/service-worker.js']);

const serveServiceWorker = (res) => {
  setNoCacheHeaders(res);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.end(buildServiceWorkerScript(appFingerprint));
};

const registerSwBootstrap = `(function(){
if(!('serviceWorker'in navigator))return;
navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});
})();`;

const isImmutableAsset = (pathname) =>
  pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image/');

/** Parsed URL shape expected by Next.js getRequestHandler (replaces deprecated url.parse). */
const parseRequestUrl = (req) => {
  const base = `http://${req.headers.host || `${hostname}:${port}`}`;
  const url = new URL(req.url || '/', base);
  const query = Object.fromEntries(url.searchParams);
  return {
    pathname: url.pathname,
    query,
    search: url.search,
    hash: url.hash,
    href: `${url.pathname}${url.search}${url.hash}`,
    path: `${url.pathname}${url.search}`,
  };
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parseRequestUrl(req);
    const { pathname } = parsedUrl;

    if (pathname === '/api/stats/visits') {
      handleVisitApi(req, res);
      return;
    }

    if (pathname === '/api/build-id') {
      handleBuildIdApi(req, res);
      return;
    }

    if (LEGACY_SW_PATHS.has(pathname)) {
      serveServiceWorker(res);
      return;
    }

    if (pathname === '/registerSW.js') {
      setNoCacheHeaders(res);
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(registerSwBootstrap);
      return;
    }

    if (!isImmutableAsset(pathname)) {
      setNoCacheHeaders(res);
    }

    handle(req, res, parsedUrl);
  });

  attachSignaling(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`> Share P2P ready on http://${hostname}:${port} (${dev ? 'dev' : 'production'})`);
  });
});
