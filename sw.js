// Ressources publiques uniquement : jamais de cache des réponses Supabase / Microsoft.
// L'interface fonctionne de manière fluide même si le réseau répond lentement.
const CACHE='wapi-pocket-v2-connected-2-3';
const FILES=['./','./index.html','./app.js?v=23','./gps.js?v=23','./styles.css?v=23','./manifest.webmanifest','./icons/wp-v22-192.png','./icons/wp-v22-512.png','./icons/wp-v22-maskable.png','./icons/wp-v22-apple.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wapi-pocket-v2-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const isPage=req.mode==='navigate'||/\/(?:index\.html)$/.test(url.pathname)||url.pathname===scope.pathname;
 const asset=/\/(?:app\.js|gps\.js|styles\.css|manifest\.webmanifest|wp-v22-[^/]+\.png)$/.test(url.pathname);
 if(!isPage&&!asset)return;
 if(asset){
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(resp=>{
   if(resp.ok)event.waitUntil(caches.open(CACHE).then(c=>c.put(req,resp.clone())).catch(()=>{}));
   return resp;
  })));
  return;
 }
 event.respondWith(Promise.race([
  fetch(req).then(resp=>{
   if(resp.ok)event.waitUntil(caches.open(CACHE).then(c=>c.put(req,resp.clone())).catch(()=>{}));
   return resp;
  }),
  new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),2500))
 ]).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
});
