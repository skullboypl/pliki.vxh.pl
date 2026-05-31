/** Service worker body — fingerprint injected per deploy / dev server start. */
function buildServiceWorkerScript(fingerprint) {
  return `'use strict';
var F=${JSON.stringify(fingerprint)};
var CACHE='vxh-'+F;

self.addEventListener('install',function(){
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil((async function(){
    var keys=await caches.keys();
    await Promise.all(
      keys
        .filter(function(k){return k.indexOf('vxh-')===0&&k!==CACHE;})
        .map(function(k){return caches.delete(k);})
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message',function(e){
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

/* No fetch handler — app is network-only (WebSocket/WebRTC). Intercepting GET
   caused uncaught "Failed to fetch" and broke transfers in dev/PWA. */
`;
}

module.exports = { buildServiceWorkerScript };
