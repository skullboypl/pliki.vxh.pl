const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const { execSync, spawnSync } = require('child_process');

const CERT_DIR = path.join(__dirname, '..', '.cert');
const KEY_PATH = path.join(CERT_DIR, 'dev-key.pem');
const CERT_PATH = path.join(CERT_DIR, 'dev-cert.pem');
const SOURCE_PATH = path.join(CERT_DIR, '.source');

/** Dev: HTTPS domyślnie. Wyłącz: DEV_HTTP=1 lub DEV_HTTPS=0 */
const isEnabled = () => {
  const httpsFlag = String(process.env.DEV_HTTPS || '').trim().toLowerCase();
  if (httpsFlag === '0' || httpsFlag === 'false' || httpsFlag === 'no') return false;
  if (String(process.env.DEV_HTTP || '').trim() === '1') return false;
  if (process.env.NODE_ENV === 'development') return true;
  return httpsFlag === '1' || httpsFlag === 'true' || httpsFlag === 'yes';
};

function collectHostnames() {
  const hosts = new Set(['localhost', '127.0.0.1', '::1']);
  try {
    const hn = os.hostname()?.trim();
    if (hn && hn !== 'localhost') hosts.add(hn.toLowerCase());
  } catch {
    /* ignore */
  }
  const extra = String(process.env.DEV_TLS_HOSTS || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const h of extra) hosts.add(h);

  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) hosts.add(net.address);
    }
  }
  return [...hosts];
}

function readSource() {
  try {
    return fs.readFileSync(SOURCE_PATH, 'utf8').trim();
  } catch {
    return '';
  }
}

function writeSource(source) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(SOURCE_PATH, `${source}\n`, 'utf8');
}

function findMkcertBin() {
  if (process.env.MKCERT_PATH?.trim()) return process.env.MKCERT_PATH.trim();
  const tryWhich = process.platform === 'win32' ? 'where mkcert' : 'command -v mkcert';
  try {
    const out = execSync(tryWhich, { encoding: 'utf8', shell: true }).trim();
    const line = out.split(/\r?\n/).find((l) => l.trim());
    return line?.trim() || null;
  } catch {
    return null;
  }
}

function removeCertFiles() {
  for (const p of [KEY_PATH, CERT_PATH, SOURCE_PATH]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

function toAltNames(hosts) {
  const altNames = [];
  for (const host of hosts) {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      altNames.push({ type: 7, ip: host });
    } else {
      altNames.push({ type: 2, value: host });
    }
  }
  return altNames;
}

function runMkcertInstall(mkcert) {
  const run = spawnSync(mkcert, ['-install'], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    shell: false,
  });
  const out = `${run.stdout || ''}\n${run.stderr || ''}`;
  if (/already installed/i.test(out)) return true;
  return run.status === 0;
}

function isMkcertCertificatePem(pem) {
  if (!pem) return false;
  return /mkcert development CA/i.test(pem) || /O=mkcert development CA/i.test(pem);
}

function parseCertSan(hostsFromCert) {
  if (!hostsFromCert) return new Set();
  const set = new Set();
  for (const part of hostsFromCert.split(',').map((s) => s.trim())) {
    const dns = part.replace(/^DNS:/i, '').trim();
    const ip = part.replace(/^IP(?: Address)?:/i, '').trim();
    if (dns) set.add(dns);
    if (ip) set.add(ip);
  }
  return set;
}

function getCertSanSet() {
  try {
    const pem = fs.readFileSync(CERT_PATH, 'utf8');
    const cert = new crypto.X509Certificate(pem);
    return parseCertSan(cert.subjectAltName);
  } catch {
    return new Set();
  }
}

function hostsCoveredByCert(requiredHosts) {
  const san = getCertSanSet();
  if (!san.size) return false;
  return requiredHosts.every((h) => san.has(h));
}

function keyMatchesCert() {
  try {
    tls.createSecureContext({
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH),
    });
    return true;
  } catch {
    return false;
  }
}

function getCertValidity() {
  try {
    const x = new crypto.X509Certificate(fs.readFileSync(CERT_PATH, 'utf8'));
    const from = Date.parse(x.validFrom);
    const to = Date.parse(x.validTo);
    const now = Date.now();
    const skewMs = 2 * 60 * 1000;
    return {
      validFrom: x.validFrom,
      validTo: x.validTo,
      active: now + skewMs >= from && now - skewMs <= to,
      notYet: now + skewMs < from,
      expired: now - skewMs > to,
      san: x.subjectAltName,
    };
  } catch {
    return null;
  }
}

function certNeedsRegeneration(hosts) {
  if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) return true;
  if (readSource() !== 'mkcert') return true;
  const pem = fs.readFileSync(CERT_PATH, 'utf8');
  if (!isMkcertCertificatePem(pem)) return true;
  if (!keyMatchesCert()) return true;
  if (!hostsCoveredByCert(hosts)) return true;
  const validity = getCertValidity();
  if (!validity?.active) return true;
  return false;
}

/** mkcert — lokalne CA, cert jak „normalny” na tym PC (i na telefonie po root CA). */
function generateWithMkcert({ force = false } = {}) {
  const mkcert = findMkcertBin();
  if (!mkcert) return null;

  const hosts = collectHostnames();
  if (!force && !certNeedsRegeneration(hosts)) {
    return loadPemFiles(hosts, false, 'mkcert');
  }

  if (!runMkcertInstall(mkcert)) {
    console.warn('[share] mkcert -install nie powiodło się — Chrome może pokazać „Niezabezpieczona”.');
  }

  if (force || certNeedsRegeneration(hosts)) removeCertFiles();

  const projectRoot = path.join(__dirname, '..');
  fs.mkdirSync(CERT_DIR, { recursive: true });
  // Względne ścieżki — mkcert na Windows gryzie się z [ ] i spacjami w absolutnej ścieżce projektu.
  const args = [
    '-key-file',
    path.join('.cert', 'dev-key.pem'),
    '-cert-file',
    path.join('.cert', 'dev-cert.pem'),
    ...hosts,
  ];
  const run = spawnSync(mkcert, args, {
    encoding: 'utf8',
    cwd: projectRoot,
    shell: false,
  });

  if (run.status !== 0) {
    const msg = (run.stderr || run.stdout || '').trim();
    if (msg) console.warn('[share] mkcert:', msg);
    return null;
  }

  writeSource('mkcert');
  return loadPemFiles(hosts, true, 'mkcert');
}

function generateSelfSigned({ force = false } = {}) {
  const hosts = collectHostnames();
  if (!force && fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return loadPemFiles(hosts, false, readSource() || 'selfsigned');
  }

  if (force) removeCertFiles();

  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch {
    console.error('\n[share] Brak pakietu selfsigned. Uruchom: pnpm install\n');
    process.exit(1);
  }

  const attrs = [{ name: 'commonName', value: 'pliki.vxh.pl dev' }];
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 825,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: toAltNames(hosts) },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
  fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');
  writeSource('selfsigned');
  return loadPemFiles(hosts, true, 'selfsigned');
}

function readServerCertPem(source) {
  let cert = fs.readFileSync(CERT_PATH);
  if (source === 'mkcert') {
    try {
      const mkcert = findMkcertBin();
      if (mkcert) {
        const run = spawnSync(mkcert, ['-CAROOT'], { encoding: 'utf8', shell: false });
        const caroot = (run.stdout || '').trim();
        const rootCa = path.join(caroot, 'rootCA.pem');
        if (caroot && fs.existsSync(rootCa)) {
          cert = Buffer.concat([cert, Buffer.from('\n'), fs.readFileSync(rootCa)]);
        }
      }
    } catch {
      /* leaf only */
    }
  }
  return cert;
}

function loadPemFiles(hosts, generated, source) {
  return {
    key: fs.readFileSync(KEY_PATH),
    cert: readServerCertPem(source),
    hosts,
    generated,
    source,
  };
}

function loadOrCreate() {
  const hosts = collectHostnames();
  const allowSelf = String(process.env.DEV_TLS_SELF || '').trim() === '1';

  if (!allowSelf) {
    const mk = generateWithMkcert({ force: certNeedsRegeneration(hosts) });
    if (mk) return mk;
    console.error(`
[share] Brak certyfikatu mkcert — Chrome pokaże „Niezabezpieczona”.

  winget install FiloSottile.mkcert
  mkcert -install
  pnpm cert:mkcert
  pnpm dev

Albo świadomie self-signed: pnpm cert:selfsigned i DEV_TLS_SELF=1 pnpm dev
`);
    process.exit(1);
  }

  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return loadPemFiles(hosts, false, readSource() || 'unknown');
  }

  const mk = generateWithMkcert({ force: false });
  if (mk) return mk;
  return generateSelfSigned({ force: false });
}

/** Wywoływane przed pnpm dev — wymusza mkcert i świeży SAN (IP w WiFi). */
function ensureMkcertDevCert({ exitOnFail = false } = {}) {
  if (!isEnabled()) return true;
  const hosts = collectHostnames();
  const mkcert = findMkcertBin();
  if (!mkcert) {
    const msg =
      '[share] mkcert nie znaleziony. Zainstaluj: winget install FiloSottile.mkcert';
    if (exitOnFail) {
      console.error(msg);
      return false;
    }
    console.warn(msg);
    return false;
  }
  runMkcertInstall(mkcert);
  const result = generateWithMkcert({ force: certNeedsRegeneration(hosts) });
  if (!result) {
    if (exitOnFail) console.error('[share] Nie udało się wygenerować cert:mkcert');
    return false;
  }
  return true;
}

function getHttpsOptions() {
  if (!isEnabled()) return null;
  return loadOrCreate();
}

function printDevTlsBanner(port, hostname, tls) {
  const proto = 'https';
  console.log(`> Share P2P ready on ${proto}://${hostname}:${port} (dev + TLS)`);
  console.log(
    `> Cert: ${tls.source === 'mkcert' ? 'mkcert (zaufany na PC po mkcert -install)' : 'self-signed'} → ${CERT_PATH}`,
  );
  if (tls.generated) console.log('> Nowo wygenerowany certyfikat');
  console.log(`> SAN: ${tls.hosts.join(', ')}`);
  console.log(`> Otwórz w Chrome: ${proto}://127.0.0.1:${port}  (nie http://)`);
  console.log(`> Otwórz w Chrome: ${proto}://localhost:${port}`);

  const lan = tls.hosts.filter((h) => /^\d+\.\d+\.\d+\.\d+$/.test(h) && h !== '127.0.0.1');
  for (const ip of lan) {
    console.log(`> Telefon (WiFi): ${proto}://${ip}:${port}`);
  }

  if (tls.source === 'mkcert') {
    const v = getCertValidity();
    if (v) console.log(`> Cert ważny: ${v.validFrom} → ${v.validTo}`);
    console.log('> Chrome: https://127.0.0.1:' + port + ' (czasem lepsze niż localhost)');
    console.log('> Nadal „Niezabezpieczona” przy ważnym cert? chrome://flags → wyłącz');
    console.log('>   „Allow invalid certificates for resources loaded from localhost” → Restart');
    console.log('> Potem: mkcert -install, zamknij Chrome, pnpm cert:mkcert, pnpm dev');
  } else {
    console.log('> Zaufany cert: mkcert -install && pnpm cert:mkcert');
  }
}

module.exports = {
  isDevHttpsEnabled: isEnabled,
  getHttpsOptions,
  printDevTlsBanner,
  generateWithMkcert,
  generateSelfSigned,
  ensureMkcertDevCert,
  collectHostnames,
  certNeedsRegeneration,
  getCertValidity,
  CERT_DIR,
};
