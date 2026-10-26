// Cache uniquement les ressources statiques publiques de l'application.
// JAMAIS de cache des API Supabase, Microsoft Graph, Google Calendar, ni des données privées.
const CACHE='wapi-pocket-v2-connected-1';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('wapi-pocket-v2-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;const url=new URL(req.url);if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}return resp}))) });
