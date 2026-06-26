const { createServer: createHttpServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');
const { Server } = require('socket.io');
const { generateNicknameSlug } = require('./shared/nicknames.js');
const socketRateLimit = require('./server/socketRateLimit');
const { buildServiceWorkerScript } = require('./server/pwaServiceWorker');
const log = require('./server/logger');
const {
  isDevHttpsEnabled,
  getHttpsOptions,
  printDevTlsBanner,
} = require('./server/devTls');
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

/** Production: .next/BUILD_ID. Dev: stable id — per-restart random ids break LAN/mobile chunk loads. */
const appBuildId = dev ? process.env.DEV_BUILD_ID || 'dev-local' : readBuildId();
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
const devHttps = dev && isDevHttpsEnabled();
const devTls = devHttps ? getHttpsOptions() : null;
const requestProtocol = devHttps ? 'https' : 'http';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** @type {Map<string, { publicIp: string, name: string, device: string, standalone: boolean }>} */
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
      standalone: !!data.standalone,
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
      log.warn('socket rejected', { reason: 'rate_limited', ip: publicIp });
      return next(new Error('rate_limited'));
    }
    if (countClientsFromIp(publicIp) >= socketRateLimit.MAX_CONCURRENT_PER_IP) {
      log.warn('socket rejected', { reason: 'too_many_connections', ip: publicIp });
      return next(new Error('too_many_connections'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const publicIp = remoteIp(socket);
    const name = generateNicknameSlug(namesInGroup(publicIp));
    clients.set(socket.id, { publicIp, name, device: 'desktop', standalone: false });
    socket.emit('assigned_name', { name, shortId: shortId(socket.id) });
    broadcastPeers(io);
    log.event('socket.connect', {
      id: shortId(socket.id),
      ip: publicIp,
      name,
      transport: socket.conn?.transport?.name,
      groupSize: countClientsFromIp(publicIp),
      total: clients.size,
    });

    socket.on('register_device', (payload) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      if (!clients.has(socket.id)) return;
      const entry = clients.get(socket.id);
      if (typeof payload === 'string') {
        entry.device = normalizeDevice(payload);
        entry.standalone = false;
      } else if (payload && typeof payload === 'object') {
        entry.device = normalizeDevice(payload.device);
        entry.standalone = !!payload.standalone;
      }
      broadcastPeers(io);
      log.event('socket.register_device', {
        id: shortId(socket.id),
        device: entry.device,
        standalone: entry.standalone,
      });
    });

    socket.on('register_name', (rawName) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const trimmed = String(rawName || '').trim().substring(0, 24);
      if (trimmed && clients.has(socket.id)) {
        clients.get(socket.id).name = trimmed;
        broadcastPeers(io);
        log.event('socket.register_name', { id: shortId(socket.id), name: trimmed });
      }
    });

    socket.on('signal', ({ to, signal }) => {
      if (!socketRateLimit.allowSignal(socket.id, publicIp)) {
        log.warn('signal dropped', { reason: 'rate_limited', from: shortId(socket.id), ip: publicIp });
        return;
      }
      const delivered = clients.has(to);
      if (delivered) {
        io.to(to).emit('signal', { from: socket.id, signal });
      }
      log.event('socket.signal', {
        from: shortId(socket.id),
        to: shortId(to),
        type: signal?.type,
        delivered,
      });
    });

    socket.on('request_connection', (targetId) => {
      if (!socketRateLimit.allowRequestConnection(socket.id)) {
        log.warn('request_connection dropped', { reason: 'rate_limited', from: shortId(socket.id) });
        return;
      }
      const delivered = clients.has(targetId);
      if (delivered) {
        io.to(targetId).emit('incoming_connection_request', socket.id);
      }
      log.event('socket.request_connection', {
        from: shortId(socket.id),
        to: shortId(targetId),
        delivered,
      });
    });

    socket.on('disconnect', (reason) => {
      clients.delete(socket.id);
      io.emit('peer_disconnected', socket.id);
      broadcastPeers(io);
      log.event('socket.disconnect', {
        id: shortId(socket.id),
        ip: publicIp,
        reason,
        total: clients.size,
      });
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
  const base = `${requestProtocol}://${req.headers.host || `${hostname}:${port}`}`;
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

const createAppServer = (handler) => {
  if (devHttps && devTls) {
    return createHttpsServer({ key: devTls.key, cert: devTls.cert }, handler);
  }
  return createHttpServer(handler);
};

app.prepare().then(() => {
  const httpServer = createAppServer((req, res) => {
    const parsedUrl = parseRequestUrl(req);
    const { pathname } = parsedUrl;

    if (log.verbose && !isImmutableAsset(pathname)) {
      const startedAt = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
        log.event('http', {
          method: req.method,
          path: pathname,
          status: res.statusCode,
          ms: Math.round(ms),
          ip:
            (req.headers['x-real-ip'] ||
              req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
              req.socket?.remoteAddress ||
              '')
              .toString()
              .replace(/^::ffff:/, ''),
        });
      });
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
      if (devHttps) {
        res.setHeader('Content-Security-Policy', 'upgrade-insecure-requests');
      }
    }

    handle(req, res, parsedUrl);
  });

  attachSignaling(httpServer);

  const redirectPort = parseInt(process.env.DEV_HTTP_REDIRECT_PORT || String(port + 1), 10);
  let httpRedirectServer = null;
  if (devHttps && devTls && redirectPort > 0 && redirectPort !== port) {
    httpRedirectServer = createHttpServer((req, res) => {
      const hostHeader = req.headers.host || `127.0.0.1:${port}`;
      const hostOnly = hostHeader.replace(/:\d+$/, '') || '127.0.0.1';
      const targetHost = hostOnly === '0.0.0.0' ? '127.0.0.1' : hostOnly;
      const location = `https://${targetHost}:${port}${req.url || '/'}`;
      res.writeHead(308, { Location: location, 'Cache-Control': 'no-store' });
      res.end();
    });
    httpRedirectServer.listen(redirectPort, hostname, () => {
      console.log(`> HTTP → HTTPS: http://127.0.0.1:${redirectPort} → https://127.0.0.1:${port}`);
    });
  }

  httpServer.listen(port, hostname, () => {
    if (devHttps && devTls) {
      printDevTlsBanner(port, hostname, devTls);
      log.banner();
      if (httpRedirectServer) {
        console.log(`> Jeśli wpisujesz http:// — użyj portu ${redirectPort} albo od razu https://`);
      }
      return;
    }
    const mode = dev ? 'dev' : 'production';
    console.log(`> Share P2P ready on http://${hostname}:${port} (${mode})`);
    log.banner();
    if (dev) {
      console.log('> Bez TLS: pnpm dev:http');
    }
  });
});
