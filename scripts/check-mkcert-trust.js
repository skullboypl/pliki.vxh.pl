#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');

const projectRoot = path.join(__dirname, '..');
const leafPath = path.join(projectRoot, '.cert', 'dev-cert.pem');
const ps1 = path.join(__dirname, 'check-mkcert-trust.ps1');

if (!fs.existsSync(leafPath)) {
  console.error('Brak .cert/dev-cert.pem — uruchom: pnpm cert:mkcert');
  process.exit(1);
}

const leaf = new crypto.X509Certificate(fs.readFileSync(leafPath));
const caroot = execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim();
const rootPath = path.join(caroot, 'rootCA.pem');
const root = new crypto.X509Certificate(fs.readFileSync(rootPath));

console.log('=== mkcert trust (Windows) ===\n');
console.log('Leaf → rootCA.pem:', leaf.checkIssued(root) ? 'OK' : 'BŁĄD');

const run = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/check-mkcert-trust.ps1'],
  { encoding: 'utf8', cwd: projectRoot },
);

if (run.status !== 0 && !run.stdout) {
  console.error(run.stderr || 'check-mkcert-trust.ps1 failed');
  process.exit(1);
}

const lines = (run.stdout || '').split(/\r?\n/).filter(Boolean);
const map = Object.fromEntries(
  lines
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

console.log('Root file (mkcert -CAROOT):', map.FILE_THUMB || '?');
console.log('W magazynie Windows:', map.ANY_MATCH === 'True' ? 'TAK (ten sam CA)' : 'NIE');

if (run.status !== 0 || map.ANY_MATCH !== 'True') {
  console.log(`
Chrome: „Certyfikat jest nieprawidłowy” — CA w systemie ≠ CA który podpisał cert.

Naprawa (w PowerShell):

  mkcert -uninstall
  mkcert -install
  pnpm cert:mkcert
  pnpm dev

Potem zamknij cały Chrome i wejdź na https://127.0.0.1:3000
`);
  process.exit(1);
}

console.log('\nOK — zaufany CA zgadza się z certem dev.');
process.exit(0);
