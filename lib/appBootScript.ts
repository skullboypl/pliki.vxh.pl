import {
  APP_FINGERPRINT_KEY,
  BOOT_RELOAD_KEY,
  LEGACY_BUILD_KEY,
} from '@/lib/appVersion';

/** Runs in <head> before React — clears SW/cache only when stored fingerprint ≠ server fingerprint. */
export function appBootScript(isDev = false): string {
  return `(function(){
  var DEV=${isDev ? 'true' : 'false'};
  var FP='${APP_FINGERPRINT_KEY}';
  var RL='${BOOT_RELOAD_KEY}';
  var LEG='${LEGACY_BUILD_KEY}';
  var CHK='vxh_chunk_reload';
  function metaFp(){
    var m=document.querySelector('meta[name="vxh-app-version"]');
    return m&&m.getAttribute('content')||'';
  }
  function clearAll(){
    var ps=[];
    if('caches'in window)ps.push(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}))}));
    if('serviceWorker'in navigator)ps.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister()}))}));
    return Promise.all(ps);
  }
  function apply(next){
    if(!next)return;
    var prev=localStorage.getItem(FP);
    var legacy=localStorage.getItem(LEG);
    if(prev===next){sessionStorage.removeItem(RL);sessionStorage.removeItem(CHK);return;}
    if(DEV){
      localStorage.setItem(FP,next);
      localStorage.removeItem(LEG);
      sessionStorage.removeItem(RL);
      return;
    }
    if(!prev){
      if(legacy&&legacy!==next.split('@')[0]){
        if(sessionStorage.getItem(RL)!=='1'){
          sessionStorage.setItem(RL,'1');
          return clearAll().then(function(){localStorage.setItem(FP,next);localStorage.removeItem(LEG);location.reload();});
        }
      }
      localStorage.setItem(FP,next);
      localStorage.removeItem(LEG);
      sessionStorage.removeItem(RL);
      return;
    }
    if(sessionStorage.getItem(RL)==='1'){
      localStorage.setItem(FP,next);
      sessionStorage.removeItem(RL);
      return;
    }
    sessionStorage.setItem(RL,'1');
    return clearAll().then(function(){
      localStorage.setItem(FP,next);
      localStorage.removeItem(LEG);
      location.reload();
    });
  }
  function isChunkLoadMsg(msg){
    if(!msg)return false;
    return /originalFactory|factory is not available|Loading chunk|ChunkLoadError|Cannot read properties of undefined.*call/i.test(String(msg));
  }
  function recoverChunkOnce(){
    if(sessionStorage.getItem(CHK)==='1')return;
    sessionStorage.setItem(CHK,'1');
    if('caches'in window){
      caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}));}).finally(reloadHard);
    }else reloadHard();
  }
  function reloadHard(){
    var u=location.pathname+location.search;
    if(u.indexOf('?_=')===-1)u+=(location.search?'&':'?')+'_='+Date.now();
    else u=u.replace(/([?&])_=[^&]*/,'$1_='+Date.now());
    location.replace(u);
  }
  window.addEventListener('error',function(e){
    if(isChunkLoadMsg(e&&e.message))recoverChunkOnce();
  });
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason;
    var msg=r&&(r.message||r.toString&&r.toString())||'';
    if(isChunkLoadMsg(msg))recoverChunkOnce();
  });
  var current=metaFp();
  if(current){
    var stored=localStorage.getItem(FP);
    if(stored===current)return;
    apply(current);
    return;
  }
  fetch('/api/build-id?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache',Pragma:'no-cache'}})
    .then(function(r){return r.ok?r.json():null})
    .then(function(d){
      if(!d||!d.fingerprint)return;
      apply(d.fingerprint);
    })
    .catch(function(){});
  if('serviceWorker'in navigator){
    navigator.serviceWorker.addEventListener('message',function(e){
      var d=e&&e.data;
      if(!d||d.type!=='VXH_APP_UPDATE')return;
      var next=d.fingerprint||metaFp();
      if(!next)return;
      apply(next);
    });
  }
})();`;
}
