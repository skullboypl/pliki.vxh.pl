#!/usr/bin/env node
/**
 * Przed pnpm dev: wymusza cert mkcert (bez self-signed w Chrome).
 */
process.env.NODE_ENV = 'development';

const {
  ensureMkcertDevCert,
  isDevHttpsEnabled,
} = require('../server/devTls');

if (!isDevHttpsEnabled()) {
  process.exit(0);
}

const ok = ensureMkcertDevCert({ exitOnFail: true });
if (!ok) process.exit(1);

const check = require('child_process').spawnSync(
  'node',
  [require('path').join(__dirname, 'check-mkcert-trust.js')],
  { encoding: 'utf8', cwd: require('path').join(__dirname, '..') },
);
if (check.status !== 0) {
  console.error('\n[share] Uruchom naprawę zaufania CA: pnpm cert:fix-trust\n');
  process.exit(1);
}
process.exit(0);
