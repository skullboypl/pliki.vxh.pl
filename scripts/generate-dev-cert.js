#!/usr/bin/env node
/**
 * Regeneruje .cert/ — najpierw mkcert (zaufany), potem self-signed.
 */
const {
  generateWithMkcert,
  generateSelfSigned,
  collectHostnames,
  CERT_DIR,
} = require('../server/devTls');

process.env.NODE_ENV = 'development';

const force = process.argv.includes('--force') || process.argv.includes('-f');
const selfOnly = process.argv.includes('--selfsigned');

let result = null;
if (!selfOnly) {
  result = generateWithMkcert({ force });
}
if (!result) {
  result = generateSelfSigned({ force });
}

if (!result) {
  console.error('Nie udało się wygenerować certyfikatu.');
  process.exit(1);
}

console.log(`Certyfikat (${result.source}) zapisany w:`, CERT_DIR);
console.log('SAN:', result.hosts.join(', '));
if (result.source === 'selfsigned') {
  console.log('Zaufany dev HTTPS: zainstaluj mkcert i uruchom pnpm cert:mkcert');
}
