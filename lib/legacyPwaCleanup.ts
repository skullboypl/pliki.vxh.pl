export const LEGACY_PWA_SESSION_KEY = 'vxh_legacy_cache_cleaned_v1';

export function legacyPwaCleanupScript(): string {
  return `(function(){try{if(sessionStorage.getItem('${LEGACY_PWA_SESSION_KEY}'))return;if(!('serviceWorker'in navigator))return;navigator.serviceWorker.getRegistrations().then(function(regs){if(!regs.length){sessionStorage.setItem('${LEGACY_PWA_SESSION_KEY}','1');return;}Promise.all(regs.map(function(r){return r.unregister();})).then(function(){var p='caches'in window?caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n);}));}):Promise.resolve();return p;}).then(function(){sessionStorage.setItem('${LEGACY_PWA_SESSION_KEY}','1');location.reload();});});}catch(e){}})();`;
}

export async function purgeLegacyPwa(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(LEGACY_PWA_SESSION_KEY)) return false;

  let changed = false;

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length) {
      await Promise.all(regs.map((reg) => reg.unregister()));
      changed = true;
    }
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    if (keys.length) {
      await Promise.all(keys.map((key) => caches.delete(key)));
      changed = true;
    }
  }

  sessionStorage.setItem(LEGACY_PWA_SESSION_KEY, '1');
  return changed;
}
