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

function dlEscHtml(value){
  return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dlFormatBytes(bytes){
  var n=Number(bytes)||0;
  if(n<=0)return'0 B';
  if(n<1024*1024)return(n/1024).toFixed(1)+' KB';
  if(n<1024*1024*1024)return(n/(1024*1024)).toFixed(1)+' MB';
  return(n/(1024*1024*1024)).toFixed(2)+' GB';
}

function dlLandingHtml(rec,lang,token){
  var en=lang==='en';
  var title=en?'Download file':'Pobierz plik';
  var back=en?'Back to app':'Wróć do apki';
  var start=en?'Download file':'Pobierz plik';
  var hint=en
    ?'Tap Download file. iOS saves it to Files. You can return anytime.'
    :'Dotknij Pobierz plik. iOS zapisze plik w aplikacji Pliki. Możesz wrócić w każdej chwili.';
  var expired=en?'Download link expired. Close and open Save file again.':'Link wygasł. Zamknij i otwórz Zapisz plik ponownie.';
  var name=rec?dlEscHtml(rec.fileName):'';
  var size=rec?dlFormatBytes(rec.size):'';
  var fileHref=rec?('/received-file/'+token+'?dl=1'):'#';
  var dlName=rec?dlSafeName(rec.fileName):'file';
  var body=rec
    ?'<p class="name">'+name+'</p><p class="meta">'+size+'</p><p class="hint">'+hint+'</p><a class="btn primary" href="'+fileHref+'" download="'+dlEscHtml(dlName)+'">'+start+'</a>'
    :'<p class="hint">'+expired+'</p>';
  return '<!DOCTYPE html><html lang="'+(en?'en':'pl')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'
    +'body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e8e8e8}'
    +'.card{max-width:420px;width:100%;padding:24px;border:1px solid #2a2a2a;border-radius:12px;background:#111}'
    +'.title{margin:0 0 16px;font-size:1.15rem}'
    +'.name{margin:0 0 6px;font-size:0.95rem;word-break:break-word}'
    +'.meta{margin:0 0 14px;font-size:0.82rem;color:#9ab08f}'
    +'.hint{margin:0 0 18px;font-size:0.84rem;line-height:1.45;color:#b8b8b8}'
    +'.btn{display:block;box-sizing:border-box;width:100%;margin:0 0 10px;padding:14px 16px;border-radius:8px;font-size:1rem;font-weight:600;text-align:center;text-decoration:none}'
    +'.btn.primary{background:#3d7a4a;color:#fff}'
    +'.btn.ghost{background:transparent;color:#c8c8c8;border:1px solid #3a3a3a}'
    +'</style></head><body><main class="card"><h1 class="title">'+title+'</h1>'+body
    +'<a class="btn ghost" href="/">'+back+'</a></main></body></html>';
}

async function serveReceivedDownloadLanding(token,lang){
  try{
    var rec=await dlGetRecord(token);
    if(!rec||!rec.opfsEntryName||rec.expiresAt<Date.now()){
      return new Response(dlLandingHtml(null,lang,token),{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    }
    return new Response(dlLandingHtml(rec,lang,token),{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }catch(err){
    console.error('[vxh] received download landing failed',err);
    return new Response(dlLandingHtml(null,lang,token),{status:500,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }
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
    console.error('[vxh] received download failed',err);
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
  var lang=url.searchParams.get('lang')==='en'?'en':'pl';
  if(url.searchParams.get('dl')!=='1'){
    e.respondWith(serveReceivedDownloadLanding(token,lang));
    return;
  }
  e.respondWith(serveReceivedDownload(token));
});
`;
}

module.exports = { buildServiceWorkerScript };
