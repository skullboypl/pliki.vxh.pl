#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

function run(cmd, args) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: projectRoot, shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('mkcert', ['-uninstall']);
const install = spawnSync('mkcert', ['-install'], { stdio: 'inherit', cwd: projectRoot, shell: false });
if (install.status !== 0) {
  console.warn('[share] mkcert -install zwrócił błąd (Java/keytool) — Windows CA i tak może być OK.');
}
require('./cert-mkcert.js');

const check = spawnSync('node', [path.join(__dirname, 'check-mkcert-trust.js')], {
  stdio: 'inherit',
  cwd: projectRoot,
});
process.exit(check.status ?? 0);
