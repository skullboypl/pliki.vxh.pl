import {
  APP_FINGERPRINT_KEY,
  BOOT_RELOAD_KEY,
  LEGACY_BUILD_KEY,
} from '@/lib/appVersion';

/** Runs in <head> before React — clears SW/cache only when stored fingerprint ≠ server fingerprint. */
export function appBootScript(): string {
  return `(function(){
  var FP='${APP_FINGERPRINT_KEY}';
  var RL='${BOOT_RELOAD_KEY}';
  var LEG='${LEGACY_BUILD_KEY}';
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
    if(prev===next){sessionStorage.removeItem(RL);return;}
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
})();`;
}
