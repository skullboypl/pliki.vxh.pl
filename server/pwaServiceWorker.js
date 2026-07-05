/** Service worker body — fingerprint injected per deploy / dev server start. */
function buildServiceWorkerScript(fingerprint) {
  return `'use strict';
var F=${JSON.stringify(fingerprint)};
var CACHE='vxh-'+F;
var DL_PREFIX='/received-file/';
var DL_DB='vxh_received_download';
var DL_STORE='tokens';

function dlOpenDb(){
  return new Promise(function(resolve,reject){
    var req=indexedDB.open(DL_DB,1);
    req.onerror=function(){reject(req.error);};
    req.onupgradeneeded=function(){
      var db=req.result;
      if(!db.objectStoreNames.contains(DL_STORE))db.createObjectStore(DL_STORE,{keyPath:'token'});
    };
    req.onsuccess=function(){resolve(req.result);};
  });
}

function dlGetRecord(token){
  return dlOpenDb().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DL_STORE,'readonly');
      tx.onerror=function(){reject(tx.error);};
      var req=tx.objectStore(DL_STORE).get(token);
      req.onsuccess=function(){resolve(req.result||null);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
    });
  });
}

function dlSafeName(name){
  return String(name||'file').replace(/[^\\w\\s.()-]+/g,'_')||'file';
}

async function serveReceivedDownload(token){
  try{
    var rec=await dlGetRecord(token);
    if(!rec||!rec.opfsEntryName||rec.expiresAt<Date.now()){
      return new Response('Download expired or missing',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
    if(!navigator.storage||!navigator.storage.getDirectory){
      return new Response('OPFS unavailable',{status:500,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
    var root=await navigator.storage.getDirectory();
    var handle=await root.getFileHandle(rec.opfsEntryName);
    var file=await handle.getFile();
    var safe=dlSafeName(rec.fileName);
    var mime=rec.mime||file.type||'application/octet-stream';
    return new Response(file.stream(),{
      status:200,
      headers:{
        'Content-Type':mime,
        'Content-Length':String(file.size),
        'Content-Disposition':'attachment; filename="'+safe+'"'
      }
    });
  }catch(err){
    return new Response('Download failed',{status:500,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
}

self.addEventListener('install',function(){
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil((async function(){
    var keys=await caches.keys();
    var stale=keys.filter(function(k){return k.indexOf('vxh-')===0&&k!==CACHE;});
    await Promise.all(stale.map(function(k){return caches.delete(k);}));
    await self.clients.claim();
    if(!stale.length)return;
    var clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(var i=0;i<clients.length;i++){
      try{
        clients[i].postMessage({type:'VXH_APP_UPDATE',fingerprint:F});
      }catch(err){}
    }
  })());
});

self.addEventListener('message',function(e){
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  var url=new URL(e.request.url);
  if(!url.pathname.startsWith(DL_PREFIX))return;
  var token=url.pathname.slice(DL_PREFIX.length).split('/')[0];
  if(!token)return;
  e.respondWith(serveReceivedDownload(token));
});
`;
}

module.exports = { buildServiceWorkerScript };
