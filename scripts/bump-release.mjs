#!/usr/bin/env node
/**
 * Bump APP_DISPLAY_VERSION (3.1 -> 3.2) and package.json semver (3.1.0 -> 3.2.0).
 * Run before push to main: pnpm release:bump
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const releasePath = path.join(root, 'lib', 'appRelease.ts');
const packagePath = path.join(root, 'package.json');

const releaseSrc = fs.readFileSync(releasePath, 'utf8');
const match = releaseSrc.match(
  /export const APP_DISPLAY_VERSION = '(\d+)\.(\d+) \((\d{4})\)';/,
);
if (!match) {
  console.error('[release:bump] Nie znaleziono APP_DISPLAY_VERSION w lib/appRelease.ts');
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const year = match[3];
const nextMinor = minor + 1;
const nextDisplay = `${major}.${nextMinor} (${year})`;
const nextSemver = `${major}.${nextMinor}.0`;

const nextReleaseSrc = releaseSrc.replace(
  /export const APP_DISPLAY_VERSION = '[^']+';/,
  `export const APP_DISPLAY_VERSION = '${nextDisplay}';`,
);
fs.writeFileSync(releasePath, nextReleaseSrc);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const prev = pkg.version;
pkg.version = nextSemver;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`[release:bump] ${prev} -> ${nextSemver}`);
console.log(`[release:bump] footer: v${nextDisplay}`);
console.log('[release:bump] Zacommituj oba pliki przed pushem na main.');
