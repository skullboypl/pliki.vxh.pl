#!/usr/bin/env node
/**
 * Generuje zaufany cert dev przez mkcert (jak normalny HTTPS lokalnie).
 */
const { ensureMkcertDevCert, collectHostnames, CERT_DIR } = require('../server/devTls');

process.env.NODE_ENV = 'development';

if (!ensureMkcertDevCert({ exitOnFail: true })) {
  console.error(`
[share] mkcert nie jest dostępny lub się nie udał.

  winget install FiloSottile.mkcert
  mkcert -install
  pnpm cert:mkcert
`);
  process.exit(1);
}

console.log('OK — certyfikat mkcert w:', CERT_DIR);
console.log('SAN:', collectHostnames().join(', '));
console.log('');
console.log('Telefon: mkcert -CAROOT → rootCA.pem → zaufaj na iPhone (patrz .cert/README.md)');
