#!/usr/bin/env node
/**
 * Diagnostyka cert dev (mkcert + SAN + daty).
 */
const tls = require('tls');
const { getCertValidity, collectHostnames, CERT_DIR } = require('../server/devTls');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.env.PORT || '3000', 10);

function readSourceSafe() {
  try {
    return fs.readFileSync(path.join(CERT_DIR, '.source'), 'utf8').trim();
  } catch {
    return '(brak)';
  }
}

console.log('=== Dev TLS ===\n');
console.log('Folder:', CERT_DIR);
console.log('.source:', readSourceSafe());
console.log('Wymagane SAN:', collectHostnames().join(', '));

const v = getCertValidity();
if (!v) {
  console.error('\nBrak lub uszkodzony dev-cert.pem — uruchom: pnpm cert:mkcert\n');
  process.exit(1);
}

console.log('\nCertyfikat:');
console.log('  od:', v.validFrom);
console.log('  do:', v.validTo);
console.log('  SAN:', v.san);
console.log('  aktywny teraz:', v.active ? 'TAK' : 'NIE');
if (v.notYet) console.log('  → cert jeszcze nie obowiązuje (poczekaj lub pnpm cert:mkcert)');
if (v.expired) console.log('  → cert wygasł (pnpm cert:mkcert)');

const hosts = ['127.0.0.1', 'localhost'];
for (const host of hosts) {
  const socket = tls.connect(
    { host, port, servername: host, rejectUnauthorized: false },
    () => {
      const cert = socket.getPeerCertificate();
      console.log(`\nPołączenie TLS ${host}:${port}: OK`);
      console.log('  subject:', cert.subject);
      console.log('  issuer:', cert.issuer?.O || cert.issuer);
      socket.end();
    },
  );
  socket.setTimeout(3000, () => {
    console.log(`\nPołączenie TLS ${host}:${port}: brak serwera (uruchom pnpm dev)`);
    socket.destroy();
  });
  socket.on('error', (err) => {
    console.log(`\nPołączenie TLS ${host}:${port}:`, err.code || err.message);
  });
}

setTimeout(() => {
  console.log(`
Chrome nadal „Niezabezpieczona” mimo ważnego cert?
  1. Adres musi być https:// (nie http://)
  2. chrome://flags → WYŁĄCZ „Allow invalid certificates for resources loaded from localhost”
  3. Zamknij cały Chrome → mkcert -install → pnpm cert:mkcert → pnpm dev
  4. Nowa karta: https://127.0.0.1:${port}
`);
}, 3500);
