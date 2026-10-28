// WAPI POCKET V3.0.3 — cache statique uniquement; aucune réponse API/Supabase/Microsoft.
const CACHE='wapi-pocket-v3-0-3-icons-root-inline';
const STATIC=['./','./index.html','./app.js?v=303','./mobile_modules.js?v=303','./gps.js?v=303','./styles.css?v=303','./pocket_plus.js?v=303','./manifest.webmanifest?v=303','./apple-touch-icon.png','./apple-touch-icon-v303.png','./apple-touch-icon-v303-152.png','./apple-touch-icon-v303-167.png','./wapi-pocket-icon-v303-192.png','./wapi-pocket-icon-v303-512.png','./wapi-pocket-maskable-v303-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async c=>{
  // A failure in a nonessential icon must not block the application update.
  await Promise.all(STATIC.map(async path=>{try{const res=await fetch(path,{cache:'reload'});if(res.ok)await c.put(path,res)}catch(_){}}));
}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('wapi-pocket-v2-')||k.startsWith('wapi-pocket-v3-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;
 const url=new URL(req.url),scope=new URL(self.registration.scope);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const page=req.mode==='navigate'||/\/index\.html$/.test(url.pathname)||url.pathname===scope.pathname;
 const asset=/\/(?:app\.js|gps\.js|mobile_modules\.js|pocket_plus\.js|styles\.css|manifest\.webmanifest|apple-touch-icon(?:-v303(?:-152|-167)?)?\.png|wapi-pocket-(?:icon|maskable)-v303-[0-9]+\.png)$/.test(url.pathname);
 if(!page&&!asset)return;
 if(asset){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok)e.waitUntil(caches.open(CACHE).then(c=>c.put(req,res.clone())).catch(()=>{}));return res})));return}
 e.respondWith(Promise.race([fetch(req).then(res=>{if(res.ok)e.waitUntil(caches.open(CACHE).then(c=>c.put(req,res.clone())).catch(()=>{}));return res}),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),3000))]).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
});
