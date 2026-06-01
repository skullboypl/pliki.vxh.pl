#!/usr/bin/env node
/**
 * Zatrzymuje proces nasłuchujący na PORT (domyślnie 3000).
 */
const { execFileSync } = require('child_process');

const port = parseInt(process.env.PORT || '3000', 10);

function killPids(pids) {
  const unique = [...new Set(pids.filter((p) => /^\d+$/.test(p) && p !== '0'))];
  if (!unique.length) {
    console.log(`[dev:stop] Nic nie nasłuchuje na porcie ${port}.`);
    return;
  }
  for (const pid of unique) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore', windowsHide: true });
      } else {
        execFileSync('kill', ['-9', pid], { stdio: 'ignore' });
      }
      console.log(`[dev:stop] Zatrzymano PID ${pid} (port ${port})`);
    } catch {
      console.warn(`[dev:stop] Nie udało się zatrzymać PID ${pid}`);
    }
  }
}

function pidsWindows(p) {
  let out;
  try {
    out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true });
  } catch {
    return [];
  }
  const pids = [];
  const suffix = `:${p}`;
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const local = cols[1] || '';
    if (!local.includes(suffix)) continue;
    const portPart = local.split(':').pop();
    if (portPart !== String(p)) continue;
    pids.push(cols[cols.length - 1]);
  }
  return pids;
}

function pidsUnix(p) {
  try {
    const out = execFileSync('lsof', ['-ti', `:${p}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    }).trim();
    return out ? out.split(/\s+/) : [];
  } catch {
    try {
      const out = execFileSync('fuser', [`${p}/tcp`], { encoding: 'utf8' }).trim();
      return out.split(/\s+/).filter(Boolean);
    } catch {
      return [];
    }
  }
}

const pids = process.platform === 'win32' ? pidsWindows(port) : pidsUnix(port);
killPids(pids);
