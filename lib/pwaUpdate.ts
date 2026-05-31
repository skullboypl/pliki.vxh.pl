const SW_URL = '/sw.js';
const UPDATE_INTERVAL_MS = 5 * 60_000;

let started = false;
let refreshing = false;

function promptWaitingWorker(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;
  if (waiting && navigator.serviceWorker.controller) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

function watchInstallingWorker(registration: ServiceWorkerRegistration): void {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
}

function bindControllerChangeReload(): void {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

async function pollForUpdates(registration: ServiceWorkerRegistration): Promise<void> {
  try {
    await registration.update();
  } catch {
    /* offline / blocked */
  }
}

/** Registers update SW. Required for PWA install (Chrome address bar / beforeinstallprompt). */
export async function registerPwaUpdateService(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (started) return;

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isSecure = window.location.protocol === 'https:' || isLocal;

  if (!isSecure) return;
  // Dev: SW only on localhost (secure context). LAN IP in dev needs HTTPS for PWA.
  if (process.env.NODE_ENV !== 'production' && !isLocal) return;

  started = true;

  try {
    bindControllerChangeReload();

    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
      updateViaCache: 'none',
    });

    watchInstallingWorker(registration);
    promptWaitingWorker(registration);

    const poll = () => pollForUpdates(registration);
    poll();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll();
    });
    window.addEventListener('focus', poll);
    window.setInterval(poll, UPDATE_INTERVAL_MS);
  } catch {
    /* SW unsupported or blocked */
  }
}
