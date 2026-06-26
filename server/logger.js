/**
 * Lekki logger dla server.js (CommonJS).
 *
 * Tryb "pełne logi" (verbose) włącza się gdy:
 *   - LOG_VERBOSE = 1/true/yes/on, ALBO
 *   - staging (NEXT_PUBLIC_DEV_BANNER włączony), ALBO
 *   - dev (NODE_ENV !== 'production').
 * Wymusić ciszę: LOG_VERBOSE=0 (działa nawet na staging).
 *
 * info/warn/error logują zawsze. debug/event tylko w trybie verbose.
 */

const TRUE_SET = new Set(['1', 'true', 'yes', 'on']);
const FALSE_SET = new Set(['0', 'false', 'no', 'off']);

const norm = (v) => String(v ?? '').trim().toLowerCase();

const isStaging = () => TRUE_SET.has(norm(process.env.NEXT_PUBLIC_DEV_BANNER));
const isDev = () => process.env.NODE_ENV !== 'production';

function computeVerbose() {
  const raw = norm(process.env.LOG_VERBOSE);
  if (FALSE_SET.has(raw)) return false;
  if (TRUE_SET.has(raw)) return true;
  return isStaging() || isDev();
}

const VERBOSE = computeVerbose();

const ts = () => new Date().toISOString();

/** Składa obiekt pól na "k=v k2=v2" (pomija undefined/null). */
const fmtFields = (fields) => {
  if (!fields || typeof fields !== 'object') return '';
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    parts.push(`${k}=${val}`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
};

const line = (level, msg, fields) => `${ts()} [${level}] ${msg}${fmtFields(fields)}`;

const logger = {
  verbose: VERBOSE,
  info: (msg, fields) => console.log(line('info', msg, fields)),
  warn: (msg, fields) => console.warn(line('warn', msg, fields)),
  error: (msg, fields) => console.error(line('error', msg, fields)),
  debug: (msg, fields) => {
    if (VERBOSE) console.log(line('debug', msg, fields));
  },
  /** Zdarzenie domenowe (socket/http) — tylko w verbose. */
  event: (name, fields) => {
    if (VERBOSE) console.log(line('event', name, fields));
  },
  banner: () => {
    const mode = VERBOSE ? 'verbose (pełne logi)' : 'quiet';
    const reason = TRUE_SET.has(norm(process.env.LOG_VERBOSE))
      ? 'LOG_VERBOSE'
      : FALSE_SET.has(norm(process.env.LOG_VERBOSE))
        ? 'LOG_VERBOSE=off'
        : isStaging()
          ? 'staging (NEXT_PUBLIC_DEV_BANNER)'
          : isDev()
            ? 'dev'
            : 'default';
    console.log(`> Logi: ${mode} [${reason}]`);
  },
};

module.exports = logger;
