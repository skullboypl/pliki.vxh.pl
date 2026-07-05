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

/**
 * Ulotny stan połączenia. OBS link jest samowystarczalny (token + PIN + rozmiar w URL),
 * serwer nic nie zapisuje na dysku ani między restartami. PIN żyje tylko póki OBS jest połączony.
 * @type {Map<string, { publicIp: string, name: string, device: string, standalone: boolean, app: string, obsPin: string | null, registered: boolean }>}
 */
const clients = new Map();
/** hostSocketId -> { name, guests: Set<socketId>, publicIp } */
const notesSessions = new Map();

/** verifiedObs: `${fromSocketId}:${toSocketId}` -> timestamp (ulotny grant na czas połączenia) */
const verifiedObs = new Map();
const OBS_PIN_GRANT_MS = 10 * 60 * 1000;

const DEVICE_KINDS = new Set(['desktop', 'iphone', 'ipad', 'android', 'mobile']);

const normalizeDevice = (value) => {
  if (value === 'obs') return 'obs';
  return DEVICE_KINDS.has(value) ? value : 'desktop';
};

/** Tab/feature room — peers only see others in the same app surface ('files' | 'camera' | 'notes'). */
const APP_SURFACES = new Set(['files', 'camera', 'notes']);

const normalizeApp = (value) => (APP_SURFACES.has(value) ? value : 'files');

const remoteIp = (socket) =>
  (socket.handshake.headers['x-real-ip'] ||
    socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    socket.handshake.address ||
    '')
    .replace(/^::ffff:/, '');

const groupKey = (ip) => ip;

const shortId = (socketId) => socketId.slice(-4).toUpperCase();

/** Kolejny wolny numer dla OBS w danej grupie sieci, np. "OBS #1". */
const nextObsName = (publicIp, selfSocketId) => {
  const used = new Set();
  for (const [id, data] of clients.entries()) {
    if (id === selfSocketId) continue;
    if (data.publicIp === publicIp && data.device === 'obs') {
      const m = /#(\d+)$/.exec(data.name || '');
      if (m) used.add(Number(m[1]));
    }
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `OBS #${n}`;
};

const namesInGroup = (publicIp) => {
  const used = new Set();
  for (const [, data] of clients.entries()) {
    if (data.publicIp === publicIp) used.add(data.name);
  }
  return used;
};

const broadcastPeers = (io) => {
  // Group by public IP + app surface so 'files' and 'camera' tabs have separate device lists.
  const groups = new Map();
  for (const [id, data] of clients.entries()) {
    // Pomiń sockety, które jeszcze nie zadeklarowały zakładki (np. OBS przed obs_join),
    // żeby nie migały w niewłaściwej grupie (np. OBS w zakładce Pliki).
    if (!data.registered) continue;
    const key = `${groupKey(data.publicIp)}|${normalizeApp(data.app)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      id,
      name: data.name,
      shortId: shortId(id),
      device: normalizeDevice(data.device),
      standalone: !!data.standalone,
      obs: data.device === 'obs',
    });
  }
  for (const [id, data] of clients.entries()) {
    const key = `${groupKey(data.publicIp)}|${normalizeApp(data.app)}`;
    const list = groups.get(key)?.filter((p) => p.id !== id) || [];
    io.to(id).emit('local_peers_update', list);
  }
};

/** Aktywne sesje Notes hostowane w LAN (ta sama publicIp, app notes). */
const broadcastNotesHosts = (io) => {
  const groups = new Map();
  for (const [id, data] of clients.entries()) {
    if (!data.registered || normalizeApp(data.app) !== 'notes' || !data.notesHosting || !data.notesHostName) continue;
    const key = groupKey(data.publicIp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      id,
      sessionName: data.notesHostName,
      hostName: data.name,
      shortId: shortId(id),
    });
  }
  for (const [id, data] of clients.entries()) {
    if (!data.registered || normalizeApp(data.app) !== 'notes') continue;
    const key = groupKey(data.publicIp);
    const list = groups.get(key)?.filter((h) => h.id !== id) || [];
    io.to(id).emit('notes_hosts_update', list);
  }
};

const promoteNotesHost = (io, newHostId, sessionName, guestIds, publicIp) => {
  const newHost = clients.get(newHostId);
  if (!newHost) return false;
  newHost.notesHosting = true;
  newHost.notesHostName = sessionName;
  newHost.notesSessionHostId = null;
  const guests = new Set(guestIds.filter((id) => id !== newHostId && clients.has(id)));
  notesSessions.set(newHostId, { name: sessionName, guests, publicIp });
  for (const gid of guests) {
    const ge = clients.get(gid);
    if (ge) ge.notesSessionHostId = newHostId;
  }
  io.to(newHostId).emit('notes_promoted_host', { sessionName, guestIds: [...guests] });
  for (const gid of guests) {
    io.to(gid).emit('notes_host_changed', { newHostId, sessionName });
  }
  broadcastNotesHosts(io);
  log.event('notes.promote_host', { id: shortId(newHostId), name: sessionName, guests: guests.size });
  return true;
};

const handleNotesHostDisconnect = (io, hostSocketId) => {
  const session = notesSessions.get(hostSocketId);
  const hostEntry = clients.get(hostSocketId);
  if (hostEntry) {
    hostEntry.notesHosting = false;
    hostEntry.notesHostName = null;
  }
  notesSessions.delete(hostSocketId);
  if (!session) {
    broadcastNotesHosts(io);
    return;
  }
  const aliveGuests = [...session.guests].filter((id) => clients.has(id)).sort();
  if (aliveGuests.length === 0) {
    broadcastNotesHosts(io);
    return;
  }
  promoteNotesHost(io, aliveGuests[0], session.name, aliveGuests.slice(1), session.publicIp);
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
    clients.set(socket.id, {
      publicIp,
      name,
      device: 'desktop',
      standalone: false,
      app: 'files',
      obsPin: null,
      registered: false,
      notesHosting: false,
      notesHostName: null,
      notesSessionHostId: null,
    });
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
        if (payload.app !== undefined) entry.app = normalizeApp(payload.app);
      }
      entry.registered = true;
      broadcastPeers(io);
      if (normalizeApp(entry.app) === 'notes') broadcastNotesHosts(io);
      log.event('socket.register_device', {
        id: shortId(socket.id),
        device: entry.device,
        standalone: entry.standalone,
        app: entry.app,
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

    socket.on('obs_join', (payload, ack) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const entry = clients.get(socket.id);
      if (!entry) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid' });
        return;
      }
      // Link jest samowystarczalny: PIN przychodzi z URL (hash), serwer nic nie pamięta.
      const pin = String(payload?.pin || '').trim().slice(0, 12) || null;
      entry.device = 'obs';
      entry.app = 'camera';
      entry.obsPin = pin;
      entry.registered = true;
      entry.name = nextObsName(entry.publicIp, socket.id);
      broadcastPeers(io);
      log.event('obs.join', { id: shortId(socket.id), gated: !!pin });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('obs_verify_pin', (payload, ack) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const to = String(payload?.to || '');
      const pin = String(payload?.pin || '').trim();
      const target = clients.get(to);
      if (!target || target.device !== 'obs') {
        if (typeof ack === 'function') ack({ ok: false, error: 'not_obs' });
        return;
      }
      const ok = !!target.obsPin && target.obsPin === pin;
      if (ok) verifiedObs.set(`${socket.id}:${to}`, Date.now());
      log.event('obs.verify_pin', { from: shortId(socket.id), to: shortId(to), ok });
      if (typeof ack === 'function') ack({ ok });
    });

    socket.on('notes_host', (payload, ack) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const entry = clients.get(socket.id);
      if (!entry || normalizeApp(entry.app) !== 'notes') {
        if (typeof ack === 'function') ack({ ok: false, error: 'not_notes' });
        return;
      }
      const name = String(payload?.name || '').trim().slice(0, 64);
      if (!name) {
        if (typeof ack === 'function') ack({ ok: false, error: 'name_required' });
        return;
      }
      entry.notesHosting = true;
      entry.notesHostName = name;
      entry.notesSessionHostId = null;
      notesSessions.set(socket.id, { name, guests: new Set(), publicIp: entry.publicIp });
      broadcastNotesHosts(io);
      log.event('notes.host', { id: shortId(socket.id), name });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('notes_stop_host', () => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const entry = clients.get(socket.id);
      if (!entry) return;
      entry.notesHosting = false;
      entry.notesHostName = null;
      notesSessions.delete(socket.id);
      broadcastNotesHosts(io);
      log.event('notes.stop_host', { id: shortId(socket.id) });
    });

    socket.on('notes_session_register', (payload) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const hostId = String(payload?.hostId || '');
      const session = notesSessions.get(hostId);
      const entry = clients.get(socket.id);
      if (!session || !entry) return;
      session.guests.add(socket.id);
      entry.notesSessionHostId = hostId;
    });

    socket.on('notes_handoff', (payload) => {
      if (!socketRateLimit.allowMisc(socket.id)) return;
      const successorId = String(payload?.successorId || '');
      const sessionName = String(payload?.sessionName || '').trim().slice(0, 64);
      const session = notesSessions.get(socket.id);
      if (!session || !sessionName || !clients.has(successorId)) return;
      const guestIds = [...session.guests].filter((id) => id !== successorId && clients.has(id));
      notesSessions.delete(socket.id);
      const hostEntry = clients.get(socket.id);
      if (hostEntry) {
        hostEntry.notesHosting = false;
        hostEntry.notesHostName = null;
      }
      promoteNotesHost(io, successorId, sessionName, guestIds, session.publicIp);
      log.event('notes.handoff', { from: shortId(socket.id), to: shortId(successorId), name: sessionName });
    });

    socket.on('signal', ({ to, signal }) => {
      if (!socketRateLimit.allowSignal(socket.id, publicIp)) {
        log.warn('signal dropped', { reason: 'rate_limited', from: shortId(socket.id), ip: publicIp });
        return;
      }
      const target = clients.get(to);
      // Gate tylko gdy OBS ma PIN (link z PIN-em). Link bez PIN-u = otwarty odbiór w LAN.
      if (target?.device === 'obs' && target.obsPin) {
        const grantKey = `${socket.id}:${to}`;
        const grantedAt = verifiedObs.get(grantKey);
        if (!grantedAt || Date.now() - grantedAt > OBS_PIN_GRANT_MS) {
          socket.emit('obs_pin_required', { to });
          log.warn('signal blocked obs pin', { from: shortId(socket.id), to: shortId(to) });
          return;
        }
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
      for (const key of verifiedObs.keys()) {
        if (key.startsWith(`${socket.id}:`) || key.endsWith(`:${socket.id}`)) verifiedObs.delete(key);
      }
      const entry = clients.get(socket.id);
      if (entry?.notesHosting) {
        handleNotesHostDisconnect(io, socket.id);
      } else if (entry?.notesSessionHostId) {
        const session = notesSessions.get(entry.notesSessionHostId);
        if (session) session.guests.delete(socket.id);
      }
      clients.delete(socket.id);
      io.emit('peer_disconnected', socket.id);
      broadcastPeers(io);
      broadcastNotesHosts(io);
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

    if (pathname.startsWith('/received-file/')) {
      setNoCacheHeaders(res);
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(
        '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pobierz plik</title></head><body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#e8e8e8;padding:24px"><p>Pobieranie wymaga aktywnej aplikacji. Zamknij i otwórz PWA ponownie.</p><p><a href="/" style="color:#9ab08f">Wróć do apki</a></p></body></html>',
      );
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
