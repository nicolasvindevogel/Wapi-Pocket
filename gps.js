/* WAPI POCKET GPS V2.5 : positions brutes locales, adresses départ/arrivée validées.
   ATTENTION : suivi PWA interrompu possible pendant appel / verrouillage. */
'use strict';
(function(){
 const DB_NAME='wapi-pocket-gps-prototype-v1', MAX_POINTS=20000;
 const S={syncFn:null,syncBusy:false,db:null,uid:null,current:null,trips:[],watchId:null,wakeLock:null,points:[],saving:Promise.resolve(),onChange:()=>{},busy:false,message:'',lastFix:null,hiddenAt:null,pendingHidden:false,tick:null,lastTick:0,lastGoodAt:0,coprosFn:null,lookupBusy:false};
 const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const dateTime=t=>t?new Date(t).toLocaleString('fr-BE',{dateStyle:'short',timeStyle:'short'}):'—';
 const km=m=>(Number(m||0)/1000).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2});
 const meters=(a,b)=>{const r=Math.PI/180,x=(b.lon-a.lon)*r*Math.cos((a.lat+b.lat)*r/2),y=(b.lat-a.lat)*r;return 6371008.8*Math.sqrt(x*x+y*y)};
 const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);

 // Le service public OSM est une aide facultative : une requête départ, une arrivée,
 // après arrêt explicite. Aucune géolocalisation continue n'est envoyée à ce service.
 // Politique : https://operations.osmfoundation.org/policies/nominatim/
 // Désactiver / remplacer l'URL à cet endroit si le service n'est plus autorisé.
 const REVERSE_URL='https://nominatim.openstreetmap.org/reverse';
 const GEO_CACHE_KEY='wp-pocket-reverse-address-v25';
 const DELAY_MS=1200;
 let nextGeoAt=0;
 const sleep=ms=>new Promise(done=>setTimeout(done,ms));
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\b(BD|BOUL)\b/g,'BOULEVARD').replace(/\b(AV)\b/g,'AVENUE').replace(/[^A-Z0-9]+/g,' ').trim();
 const placeName=a=>String(a?.city||a?.town||a?.village||a?.municipality||a?.suburb||'').trim();
 function formattedOSM(j){
  const a=j?.address||{};const street=[a.road||a.pedestrian||a.residential||a.footway||a.street,a.house_number].filter(Boolean).join(' ');
  return [street,a.postcode,placeName(a)].filter(Boolean).join(', ').slice(0,160)||String(j?.display_name||'').slice(0,160);
 }
 function coordsFromCopro(c){const p=c?.profile||{};const a=p.coordinates||p.location||{};
  const lat=Number(p.latitude??p.lat??a.lat??a.latitude??c.latitude??c.lat),lon=Number(p.longitude??p.lng??p.lon??a.lon??a.lng??a.longitude??c.longitude??c.lng??c.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)?{lat,lon}:null;
 }
 function postalAddr(c){const p=c.profile||{};return [p.address||p.street||'',p.postal_code||p.zip||p.postcode||'',p.city||p.town||''].filter(Boolean).join(', ').trim().slice(0,158)}
 function closeStreet(address,osmRoad){
   const one=normalize(String(address||'').replace(/^\s*\d{1,4}[\s,-]+/,'').replace(/[, ]+\d{1,4}[A-Z]?\s*$/i,''));
   const two=normalize(osmRoad);
   if(!one||!two)return false;return one===two||one.includes(two)&&two.length>=8||two.includes(one)&&one.length>=8;
 }
 function streetNum(s){let m=String(s||'').match(/(?:^|[,\s])([0-9]{1,4}[A-Za-z]?)\s*$/);if(!m)m=String(s||'').match(/^\s*([0-9]{1,4}[A-Za-z]?)\b/);return m?.[1]||''}
 function coproCandidates(position,osm,allow){if(!position)return [];
  const list=Array.isArray(allow)?allow:[];const a=osm?.address||{},postcode=normalize(a.postcode),city=normalize(placeName(a)),street=String(a.road||a.pedestrian||a.residential||a.footway||'');
  return list.map(c=>{const addr=postalAddr(c);if(!addr)return null;const coord=coordsFromCopro(c),distance=coord?meters(position,coord):null,p=c.profile||{};
   const postalAgree=postcode&&normalize(p.postal_code||p.postcode||p.zip)===postcode;
   const cityAgree=city&&normalize(p.city||p.town)===city;
   const sameStreet=closeStreet(p.address||p.street,street);
   const sameNumber=streetNum(p.address||p.street)&&a.house_number&&normalize(streetNum(p.address||p.street))===normalize(a.house_number);
   let score=0,detail='';
   if(Number.isFinite(distance)&&distance<=250){score=100-Math.round(distance/20);detail=`À environ ${Math.round(distance)} m du GPS`}
   else if(sameStreet&&(postalAgree||cityAgree)&&sameNumber){score=88;detail='Même adresse postale (à confirmer)'}
   else if(sameStreet&&(postalAgree||cityAgree)){score=65;detail='Même rue et commune (distance non vérifiée)'}
   if(!score)return null;return {code:String(c.code),name:String(c.name),address:addr,score,detail,distance};
  }).filter(Boolean).sort((x,y)=>y.score-x.score).slice(0,5);
 }
 function readGeoCache(){try{const j=JSON.parse(localStorage.getItem(GEO_CACHE_KEY)||'{}');return j&&typeof j==='object'?j:{}}catch{return {}}}
 function cacheKey(p){return `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`}
 async function reverseOnce(p){
  if(!p||!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon))throw Error('Position GPS non disponible');
  const k=cacheKey(p),cache=readGeoCache(),hit=cache[k];if(hit&&Date.now()-hit.at<30*86400000&&hit.value?.display_name)return hit.value;
  if(!navigator.onLine)throw Error('Hors ligne');
  const wait=Math.max(0,nextGeoAt-Date.now());if(wait)await sleep(wait);
  nextGeoAt=Date.now()+DELAY_MS;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9500);
  try{
   const u=new URL(REVERSE_URL);u.searchParams.set('format','jsonv2');u.searchParams.set('lat',String(p.lat));u.searchParams.set('lon',String(p.lon));u.searchParams.set('addressdetails','1');u.searchParams.set('zoom','18');u.searchParams.set('layer','address');u.searchParams.set('accept-language','fr');
   const r=await fetch(u.toString(),{headers:{Accept:'application/json'},signal:controller.signal,referrerPolicy:'strict-origin-when-cross-origin'});
   if(!r.ok)throw Error('Géocodage indisponible ('+r.status+')');const data=await r.json();if(data.error||!data.display_name)throw Error('Adresse introuvable');
   const value={display_name:String(data.display_name).slice(0,250),address:data.address||{}};
   cache[k]={at:Date.now(),value};const recent=Object.entries(cache).sort((a,b)=>b[1].at-a[1].at).slice(0,100);try{localStorage.setItem(GEO_CACHE_KEY,JSON.stringify(Object.fromEntries(recent)))}catch{};
   return value;
  }finally{clearTimeout(timer)}
 }
 async function resolveAddresses(trip){
  if(!trip||trip.phase!=='review'||S.lookupBusy)return;S.lookupBusy=true;trip.addressLookupStatus='Recherche des adresses GPS…';S.onChange();
  const copros=S.coprosFn?.()||[];
  for(const which of ['origin','destination']){
   if(S.current?.id!==trip.id||trip.phase!=='review')break;
   const pos=which==='origin'?trip.originPosition:trip.destinationPosition;if(!pos)continue;
   try{
    const osm=await reverseOnce(pos);
    trip[which+'Candidates']=coproCandidates(pos,osm,copros);
    const address=formattedOSM(osm);
    if(!trip[which]&&!trip[which+'ManuallyEdited']){trip[which]=address;trip[which+'Source']='osm'}
    trip[which+'LookupStatus']='Adresse proposée depuis OpenStreetMap';
   }catch(e){trip[which+'LookupStatus']='Adresse non retrouvée ('+String(e.message||e).slice(0,70)+') : complétez manuellement.';trip[which+'Candidates']=coproCandidates(pos,null,copros)}
   await persist();if(S.current?.id===trip.id)S.onChange();
  }
  trip.addressLookupStatus='';S.lookupBusy=false;await persist();if(S.current?.id===trip.id)S.onChange();
 }
 async function useCopro(which,code){if(S.current?.phase!=='review'||!['origin','destination'].includes(which))return;
  const options=S.current[which+'Candidates']||[];let selected=options.find(c=>c.code===String(code));if(!selected){const c=(S.coprosFn?.()||[]).find(c=>String(c.code)===String(code));if(c&&postalAddr(c))selected={name:String(c.name),code:String(c.code),address:postalAddr(c)}}if(!selected)return;
  S.current[which]=`${selected.name} — ${selected.address}`.slice(0,160);
  S.current[which+'Source']='copro';S.current[which+'CoproName']=selected.name;S.current[which+'CoproCode']=selected.code;S.current[which+'ManuallyEdited']=false;
  await persist();notice('Adresse de '+(which==='origin'?'départ':'arrivée')+' remplacée par celle de '+selected.name+'.');
 }
 function addressBlock(trip,which){const label=which==='origin'?'départ':'arrivée',address=trip[which]||'',opts=trip[which+'Candidates']||[],pos=trip[which+'Position'];
  return `<div class="gps-address-block"><label>Adresse de ${label}<input id="gps-${which}" maxlength="160" autocomplete="off" value="${htmlEscape(address)}" placeholder="Rue, numéro, code postal et ville"></label>
  <small class="gps-address-hint">${htmlEscape([trip[which+'LookupStatus']||(!pos?'Position GPS précise indisponible : saisie manuelle.':'Adresse modifiable avant envoi.'),which==='destination'&&trip.destinationPositionStatus==='Dernier point GPS capté avant arrêt : adresse à confirmer'?'⚠ Dernier relevé GPS uniquement, pas de position fraîche à l’arrêt.':''].filter(Boolean).join(' · '))}</small>
  ${opts.length?`<div class="gps-nearby"><b>Résidences possibles près du ${label}</b>${opts.map(c=>`<button type="button" class="gps-copro-option" data-gps-action="use-copro" data-id="${htmlEscape(c.code)}" data-endpoint="${which}"><span><strong>${htmlEscape(c.name)}</strong><small>${htmlEscape(c.address)}</small><small>${htmlEscape(c.detail)}</small></span><span class="gps-copro-choose">Utiliser</span></button>`).join('')}</div>`:''}<div class="gps-manual-copro"><label for="gps-copro-search-${which}">Ou chercher une autre copropriété</label><input id="gps-copro-search-${which}" placeholder="Nom ou adresse de résidence…" autocomplete="off"><div id="gps-copro-results-${which}"></div></div></div>`;
 }

 function notice(message){S.message=message;S.onChange();}
 function openDB(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(Error('IndexedDB indisponible sur cet appareil.'));const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('trips'))d.createObjectStore('trips',{keyPath:'id'});if(!d.objectStoreNames.contains('points')){const p=d.createObjectStore('points',{keyPath:'pk',autoIncrement:true});p.createIndex('trip_id','trip_id',{unique:false})}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
 function txSave(trip,point){return new Promise((resolve,reject)=>{const t=S.db.transaction(point?['trips','points']:['trips'],'readwrite');t.objectStore('trips').put(trip);if(point)t.objectStore('points').add({...point,trip_id:trip.id});t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error||Error('Sauvegarde GPS impossible'));t.onabort=()=>reject(t.error||Error('Sauvegarde interrompue'))})}
 function txDelete(tripId){return new Promise((resolve,reject)=>{const t=S.db.transaction(['trips','points'],'readwrite');t.objectStore('trips').delete(tripId);const index=t.objectStore('points').index('trip_id');const range=IDBKeyRange.only(tripId);const request=index.openKeyCursor(range);request.onsuccess=()=>{const c=request.result;if(c){t.objectStore('points').delete(c.primaryKey);c.continue()}};t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
 function allTrips(){return new Promise((resolve,reject)=>{const t=S.db.transaction('trips','readonly'),r=t.objectStore('trips').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 function getPoints(id){return new Promise((resolve,reject)=>{const t=S.db.transaction('points','readonly'),r=t.objectStore('points').index('trip_id').getAll(IDBKeyRange.only(id));r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 function addSave(trip,point){const snap=JSON.parse(JSON.stringify(trip));S.saving=S.saving.then(()=>txSave(snap,point)).catch(e=>{stopMonitoring();notice('Stockage local indisponible : suivi GPS suspendu. '+e.message);if(S.current)S.current.phase='interrupted';});return S.saving}
 function persist(){if(S.current)return addSave(S.current)}
 function ping(){const t=Date.now();if(t-S.lastTick>1800){S.lastTick=t;S.onChange()}}
 async function refresh(){if(!S.db||!S.uid)return;const rows=await allTrips();S.trips=rows.filter(x=>x.user_id===S.uid).sort((a,b)=>b.startedAt-a.startedAt);S.onChange()}
 async function init(userId,onChange,syncFn,coprosFn){S.coprosFn=typeof coprosFn==='function'?coprosFn:null;S.syncFn=typeof syncFn==='function'?syncFn:null;if(S.uid&&S.uid!==userId){stopMonitoring();S.current=null;S.trips=[];S.points=[];}S.uid=userId;S.onChange=onChange||(()=>{});if(!S.db)S.db=await openDB();await refresh();if(!S.current){const interrupted=S.trips.find(t=>['recording','interrupted','paused','review'].includes(t.phase));if(interrupted){S.current=interrupted;S.points=await getPoints(interrupted.id);S.lastFix=S.points.at(-1)||null;if(interrupted.phase==='recording'){interrupted.phase='interrupted';interrupted.warnings=(interrupted.warnings||[]).concat({at:Date.now(),text:'Page rechargée ou application interrompue : suivi à reprendre manuellement.'});await persist()}notice('Trajet local récupéré. Vérifiez les éventuelles portions manquantes.')}}S.onChange()}
 function geoAvailable(){return window.isSecureContext&&navigator.geolocation&&S.db}
 function singleFix(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}))}
 function normalizedFix(pos){return {lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy||999),t:pos.timestamp||Date.now()}}
 async function requestWake(){if(!('wakeLock'in navigator)||document.hidden)return;try{S.wakeLock=await navigator.wakeLock.request('screen');}catch{/* L'écran peut se verrouiller : le suivi n'est alors plus garanti. */}}
 function releaseWake(){try{S.wakeLock?.release()}catch{}S.wakeLock=null}
 function stopMonitoring(){if(S.watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(S.watchId);S.watchId=null}releaseWake();clearInterval(S.tick);S.tick=null}
 function suspendOnSignout(){if(S.current?.phase==='recording'){S.current.phase='interrupted';S.current.gpsStatus='Suivi interrompu par la déconnexion';persist()}stopMonitoring()}
 function gpsError(e){if(!S.current)return;const label=e.code===1?'Accès GPS refusé ou désactivé':e.code===2?'Signal GPS indisponible':'Recherche GPS trop longue';S.current.gpsStatus=label;S.current.warnings=S.current.warnings||[];if(e.code===1){stopMonitoring();S.current.phase='interrupted'}persist();notice(label+' — vérifiez les autorisations et le trajet.')}
 function monitor(){if(S.watchId!==null)return;S.watchId=navigator.geolocation.watchPosition(position=>{queueFix(position)},gpsError,{enableHighAccuracy:true,maximumAge:0,timeout:20000});requestWake();S.tick=setInterval(ping,2000)}
 async function queueFix(position){const trip=S.current;if(!trip||trip.phase!=='recording'||trip.user_id!==S.uid)return;const p=normalizedFix(position);
 if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.accuracy>75||p.t<trip.startedAt-10000){trip.rejected=(trip.rejected||0)+1;return}
 const old=S.lastFix;let increment=0,gap=null;
 if(old){const dt=(p.t-old.t)/1000;if(dt<=0)return;const d=meters(old,p);if(dt<4&&d<8)return;
  if(d>dt*55+25){trip.rejected=(trip.rejected||0)+1;trip.gpsStatus='Saut GPS improbable ignoré';return}
  if(dt>30||S.pendingHidden){gap={startAt:old.t,endAt:p.t,from:{lat:old.lat,lon:old.lon},to:{lat:p.lat,lon:p.lon},lineMeters:Math.round(d),reason:S.pendingHidden?'Application masquée / appel / verrouillage possible':'Absence de signal GPS'};trip.gaps=(trip.gaps||[]).concat(gap);S.pendingHidden=false}
  else if(d>=Math.max(8,((old.accuracy+p.accuracy)/2)*0.45)){increment=d}
 }
 if(S.points.length>=MAX_POINTS){trip.gpsStatus='Limite de points atteinte : terminer et valider le trajet';stopMonitoring();trip.phase='interrupted';persist();S.onChange();return}
 trip.distanceM=(trip.distanceM||0)+increment;trip.count=(trip.count||0)+1;trip.gpsStatus='Position GPS reçue';trip.lastGoodAt=p.t;trip.lastAccuracy=p.accuracy;
 S.points.push(p);S.lastFix=p;S.lastGoodAt=p.t;addSave(trip,p);ping();}
 async function start(){if(S.busy||S.current){notice('Un trajet est déjà en cours ou en attente de validation.');return}if(!geoAvailable()){notice('Le GPS nécessite HTTPS, une autorisation de localisation et le stockage local.');return}S.busy=true;S.onChange();try{
  const pos=await singleFix(),t=Date.now(),p=normalizedFix(pos);if(p.accuracy>75)throw Error('Position trop imprécise ('+p.accuracy+' m). Réessayez en extérieur.');
  const trip={id:uid(),user_id:S.uid,phase:'recording',startedAt:t,endedAt:null,distanceM:0,validatedKm:null,reason:'',purpose:'Déplacement professionnel',count:1,rejected:0,gaps:[],warnings:[],lastGoodAt:p.t,lastAccuracy:p.accuracy,gpsStatus:'GPS actif',originPosition:{lat:p.lat,lon:p.lon,t:p.t,accuracy:p.accuracy},origin:'',destination:''};
  await txSave(trip,{...p,trip_id:trip.id});S.current=trip;S.trips.unshift(trip);S.points=[p];S.lastFix=p;S.pendingHidden=false;monitor();notice('Trajet démarré. Laissez WAPI POCKET visible : écran verrouillé ou appel = relevés non garantis.');
 }catch(e){notice('Impossible de démarrer : '+(e.message||'localisation non autorisée'))}finally{S.busy=false;S.onChange()}}
 async function pause(){if(S.current?.phase!=='recording')return;stopMonitoring();S.current.phase='paused';await persist();notice('Trajet en pause. Les kilomètres de pause ne seront pas comptabilisés.')}
 async function resume(){if(S.busy||!S.current||!['paused','interrupted'].includes(S.current.phase))return;if(!geoAvailable())return notice('GPS ou stockage local indisponible');S.busy=true;S.onChange();try{const old=S.lastFix;const pos=await singleFix();const p=normalizedFix(pos);if(p.accuracy>75)throw Error('Précision insuffisante : '+p.accuracy+' m');const trip=S.current;if(old){trip.gaps=(trip.gaps||[]).concat({startAt:old.t,endAt:p.t,from:{lat:old.lat,lon:old.lon},to:{lat:p.lat,lon:p.lon},lineMeters:Math.round(meters(old,p)),reason:trip.phase==='paused'?'Pause volontaire':'Interruption / reprise de l’application'})}trip.phase='recording';trip.gpsStatus='GPS repris';S.pendingHidden=false;S.points.push(p);S.lastFix=p;await addSave(trip,p);monitor();notice('GPS repris. Vérifiez la portion non enregistrée dans le récapitulatif.')}catch(e){notice('Reprise impossible : '+(e.message||'GPS refusé'))}finally{S.busy=false;S.onChange()}}
 async function stop(){if(!S.current||!['recording','paused','interrupted'].includes(S.current.phase))return;
 const trip=S.current;stopMonitoring();trip.phase='review';trip.endedAt=Date.now();
 const origin=S.points[0]||null;
 if(!trip.originPosition&&origin)trip.originPosition={lat:origin.lat,lon:origin.lon,t:origin.t,accuracy:origin.accuracy};
 // Tentative de position finale fraîche (8 secondes max), sans inventer des kilomètres.
 // En cas d'échec, nous montrons clairement que seule la dernière position connue sert d'indication.
 let position=null;
 if(geoAvailable())try{const raw=await Promise.race([singleFix(),new Promise((_,reject)=>setTimeout(()=>reject(Error('délai dépassé')),8500))]);position=normalizedFix(raw)}catch(_){}
 if(position&&position.accuracy<=90){trip.destinationPosition={lat:position.lat,lon:position.lon,t:position.t,accuracy:position.accuracy};trip.destinationPositionStatus='Position de fin relevée'}
 else if(S.lastFix){const p=S.lastFix;trip.destinationPosition={lat:p.lat,lon:p.lon,t:p.t,accuracy:p.accuracy};trip.destinationPositionStatus='Dernier point GPS capté avant arrêt : adresse à confirmer';}
 trip.addressLookupStatus='';await persist();notice('Trajet terminé. Recherche des adresses, puis vérification avant envoi.');
 resolveAddresses(trip).catch(e=>{S.lookupBusy=false;notice('Adresses à saisir manuellement : '+e.message)});
}
 async function validate(){if(S.current?.phase!=='review')return;if(S.lookupBusy)return notice('Recherche des adresses en cours. Vous pourrez ensuite les corriger et valider.');
 const purpose=document.getElementById('gps-purpose')?.value.trim()||'';
 const value=Number(String(document.getElementById('gps-km')?.value||'').replace(',','.'));
 const why=document.getElementById('gps-reason')?.value.trim()||'';
 const origin=document.getElementById('gps-origin')?.value.trim()||'';
 const destination=document.getElementById('gps-destination')?.value.trim()||'';
 if(!Number.isFinite(value)||value<0||value>2000)return notice('Indiquez un kilométrage valide.');
 if(!purpose)return notice('Renseignez le motif du déplacement.');
 if(Math.abs(value-S.current.distanceM/1000)>0.2&&!why)return notice('Justifiez la différence entre kilomètres GPS et kilomètres validés.');
 const trip=S.current;
 trip.phase='validated';trip.validatedKm=value;trip.purpose=purpose;trip.reason=why;
 trip.origin=origin;trip.destination=destination;trip.validatedAt=Date.now();trip.syncStatus='pending';trip.syncError='';
 // La sauvegarde locale précède TOUJOURS tout transfert externe.
 await persist();await S.saving;
 S.current=null;S.points=[];S.lastFix=null;await refresh();
 notice('Trajet enregistré localement. Synchronisation avec WAPILOT…');
 await syncTrip(trip.id);
}
async function syncTrip(id,silent=false){
 const trip=S.trips.find(t=>t.id===id&&t.user_id===S.uid&&t.phase==='validated');
 if(!trip||trip.syncStatus==='sent'||!S.syncFn)return;
 // Les anciens trajets pilotes V2.3 ne doivent PAS polluer les relevés RH sans accord explicite.
 if(!trip.syncStatus){
  if(silent)return;
  if(!confirm('Ancien trajet GPS de test V2.3 : voulez-vous vraiment le transmettre dans le registre RH de WAPILOT ?'))return;
  trip.syncStatus='pending';await txSave(trip);
 }
 if(!navigator.onLine){if(!silent)notice('Hors connexion : le trajet est conservé sur ce téléphone. Touchez « Synchroniser » quand le réseau revient.');return}
 try{
  await S.saving;
  // Idempotence côté serveur par (user_id,pocket_trip_id). N'envoie AUCUN point GPS brut.
  const result=await S.syncFn(trip);
  if(result!==true)throw Error('Aucune confirmation de sauvegarde Supabase');
  trip.syncStatus='sent';trip.syncedAt=Date.now();trip.syncError='';
  await txSave(trip);
  if(!silent)notice('Trajet transmis à WAPILOT et disponible pour la fiche RH.');
 }catch(e){
  trip.syncStatus='pending';trip.syncError=String(e?.message||e).slice(0,280);
  try{await txSave(trip)}catch(_){}
  if(!silent)notice('Trajet conservé sur le téléphone, mais NON synchronisé : '+trip.syncError);
 }
 S.onChange();
}
async function syncPending(silent=false){
 if(S.syncBusy||!S.uid||!S.db||!S.syncFn)return;
 S.syncBusy=true;S.onChange();
 try{await refresh();for(const trip of S.trips.filter(x=>x.phase==='validated'&&x.syncStatus==='pending'))await syncTrip(trip.id,true);
  const pending=S.trips.filter(x=>x.phase==='validated'&&x.syncStatus==='pending');
  if(!silent)notice(pending.length?`${pending.length} trajet(s) toujours en attente. Vérifiez la connexion, le SQL et les autorisations Supabase.`:'Tous les trajets validés sont synchronisés avec WAPILOT.');
 }finally{S.syncBusy=false;S.onChange()}
}

 async function removeTrip(id){const t=S.trips.find(t=>t.id===id);if(!t||t.user_id!==S.uid)return; if(!confirm('Supprimer définitivement ce trajet et ses positions GPS de ce téléphone ?'))return;if(S.current?.id===id){stopMonitoring();S.current=null;S.points=[];S.lastFix=null}await txDelete(id);await refresh();notice('Trajet effacé de ce téléphone.')}
 function filenameSuffix(t){return new Date(t).toISOString().slice(0,10)}
 function saveDownload(data,filename,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
 async function exportCSV(){const trips=S.trips.filter(t=>t.phase==='validated');if(!trips.length)return notice('Aucun trajet validé à exporter.');const escapeCSV=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const keys=['ID','Date départ','Date arrivée','Objet','KM GPS','KM validés','Interruptions','Motif correction'];const body=trips.map(t=>[t.id,dateTime(t.startedAt),dateTime(t.endedAt),t.purpose,(t.distanceM/1000).toFixed(3),t.validatedKm,t.gaps?.length||0,t.reason].map(escapeCSV).join(';'));saveDownload('\uFEFF'+[keys.map(escapeCSV).join(';'),...body].join('\r\n'),'WAPI_POCKET_TRAJETS_'+filenameSuffix(Date.now())+'.csv','text/csv;charset=utf-8');notice('CSV exporté pour vérification. Aucun envoi automatique à WAPILOT.')}
 async function exportGPX(id){const t=S.trips.find(x=>x.id===id);if(!t||t.user_id!==S.uid)return;const pts=await getPoints(id);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const xml='<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="WAPI POCKET GPS Pilot" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+esc(t.purpose)+'</name><trkseg>'+pts.map(p=>'<trkpt lat="'+p.lat+'" lon="'+p.lon+'"><time>'+new Date(p.t).toISOString()+'</time></trkpt>').join('')+'</trkseg></trk></gpx>';saveDownload(xml,'WAPI_TRAJET_'+filenameSuffix(t.startedAt)+'_'+id.slice(0,8)+'.gpx','application/gpx+xml');notice('GPX téléchargé. Il contient les positions géographiques : fichier sensible.')}
 const dtms=t=>t?new Date(t).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
 function routeSketch(points){
 if(!Array.isArray(points)||points.length<2)return '<p class="gps-sub">Le tracé apparaîtra après plusieurs positions GPS.</p>';
 const arr=points.slice(-1500),lats=arr.map(p=>p.lat),lons=arr.map(p=>p.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
 const cy=(minLat+maxLat)/2*Math.PI/180,scaleX=Math.max(0.00004,(maxLon-minLon)*Math.cos(cy)),scaleY=Math.max(0.00004,maxLat-minLat);
 const xy=p=>{const x=18+224*((p.lon-minLon)*Math.cos(cy)/scaleX),y=18+113*((maxLat-p.lat)/scaleY);return [x,y]};
 const coords=arr.map(p=>xy(p).map(v=>v.toFixed(1)).join(',')).join(' '),start=xy(arr[0]),end=xy(arr.at(-1));
 return `<svg viewBox="0 0 260 150" role="img" aria-label="Tracé schématique du trajet, sans fond cartographique"><rect x="1" y="1" width="258" height="148" rx="14" fill="#f4faf7"/><polyline points="${coords}" fill="none" stroke="#087d6d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${start[0]}" cy="${start[1]}" r="5" fill="#24ac64" stroke="white" stroke-width="2"/><circle cx="${end[0]}" cy="${end[1]}" r="5" fill="#e89a34" stroke="white" stroke-width="2"/></svg><small class="gps-sub">Vert : départ · Orange : dernier point. Schéma indicatif, sans routes.</small>`
}
 const gapCard=g=>`<div class="gps-gap">⚠ ${htmlEscape(g.reason||'Interruption')}<small>${dtms(g.startAt)} – ${dtms(g.endAt)} · Distance directe entre deux points : ${km(g.lineMeters)} km (NON ajoutée)</small></div>`;
 function render(){if(!S.db)return `<section class="gps-panel"><h2>Enregistrement GPS</h2><p class="danger-note">${htmlEscape(S.message||'Initialisation du stockage local…')}</p></section>`;
 const t=S.current,phase=t?.phase;
 let top=`<button class="link" data-gps-action="back">← Retour</button><div class="section-title"><h1>Déplacements GPS</h1><span class="tag">Pilote · 0 €</span></div><p class="sub">Trajets professionnels mesurés sur ce téléphone, puis transmis à WAPILOT après validation. Le tracé GPS brut reste local.</p>`;
 if(S.message)top+=`<div class="gps-message" role="status">${htmlEscape(S.message)}</div>`;
 if(!t)top+=`<section class="card gps-panel"><div class="gps-icon">⌖</div><h2>Nouveau trajet</h2><p>Le GPS comptabilise les kilomètres sur la base de positions successives, y compris lorsque le trajet revient au point de départ.</p><p class="gps-caution">⚠ Un appel, un verrouillage ou un passage en arrière-plan peut couper le suivi de la PWA. Les périodes manquantes sont signalées et ne sont jamais comptées comme des kilomètres réellement mesurés.</p><button class="primary wide gps-big" data-gps-action="start" ${S.busy?'disabled':''}>▶ Démarrer le trajet</button><small>En démarrant, vous autorisez la localisation pour ce trajet professionnel. Le GPS s'arrête à la clôture.</small></section>`;
 else{
 const now=Date.now(),duration=Math.max(0,Math.floor(((t.endedAt||now)-t.startedAt)/1000)),hours=Math.floor(duration/3600),mins=Math.floor(duration%3600/60),secs=duration%60;
 top+=`<section class="card gps-panel"><div class="gps-current-head"><span class="tag ${phase==='recording'?'ok':''}">${phase==='recording'?'● En cours':phase==='paused'?'⏸ En pause':phase==='review'?'✓ Terminé':'⚠ À reprendre'}</span><span>${htmlEscape(dtms(t.startedAt))}</span></div><div class="gps-km">${km(t.distanceM)} <small>km</small></div><div class="gps-caption">Distance enregistrée par GPS uniquement</div><div class="gps-stats"><span>Durée <b>${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</b></span><span>Points <b>${t.count||0}</b></span><span>Interruptions <b>${t.gaps?.length||0}</b></span></div><p class="gps-sub">${htmlEscape(t.gpsStatus||'GPS en attente')} · Précision dernière position : ${t.lastAccuracy||'—'} m</p>`;
 if(phase==='recording')top+=`<div class="gps-actions"><button class="secondary" data-gps-action="pause">⏸ Pause</button><button class="primary" data-gps-action="stop">■ Terminer</button></div>`;
 if(phase==='paused'||phase==='interrupted')top+=`<div class="gps-actions"><button class="secondary" data-gps-action="resume" ${S.busy?'disabled':''}>▶ Reprendre</button><button class="primary" data-gps-action="stop">■ Terminer</button></div>`;
 if(phase==='review')top+=`<div class="gps-review"><label>Motif professionnel<input id="gps-purpose" maxlength="180" value="${htmlEscape(t.purpose||'Déplacement professionnel')}"></label><label>KM retenus après vérification<input id="gps-km" inputmode="decimal" type="number" min="0" max="2000" step="0.01" value="${htmlEscape(t.reviewKm??(t.distanceM/1000).toFixed(2))}"></label><p class="gps-address-notice">📍 Départ et arrivée proposés automatiquement. Si une copropriété correspond, sélectionnez-la ci-dessous. Toutes les adresses restent modifiables.</p>${addressBlock(t,'origin')}${addressBlock(t,'destination')}<button type="button" class="secondary wide gps-geolookup" data-gps-action="lookup-address" ${S.lookupBusy?'disabled':''}>${S.lookupBusy?'Recherche GPS en cours…':'↻ Rechercher les adresses GPS'}</button><p class="gps-provider">Adresses : © contributeurs OpenStreetMap (Nominatim). Lors de la recherche, uniquement les deux points départ/arrivée sont envoyés au service de géocodage. Pas de suivi en continu envoyé à ce service.</p><label>Justification si correction<textarea id="gps-reason" maxlength="500" placeholder="Ex. : appel téléphonique, GPS interrompu, détour…">${htmlEscape(t.reason||'')}</textarea></label><button class="primary wide" data-gps-action="validate" ${S.lookupBusy?'disabled':''}>✓ Valider et envoyer à WAPILOT</button><small>Les kilomètres GPS et validés restent distincts. Les points GPS détaillés ne sont pas transmis au rapport RH.</small></div>`;
 top+='</section>';
 if(S.points.length>1)top+=`<section class="card gps-panel gps-route"><h2>Parcours enregistré</h2>${routeSketch(S.points)}</section>`;
 if(t.gaps?.length)top+=`<section class="gps-gap-wrap"><h2>Portions non enregistrées (${t.gaps.length})</h2><p class="gps-caution">La distance directe affichée n'est pas un trajet routier : elle peut être nulle même si un aller-retour a eu lieu. Vérifiez les kilomètres finaux.</p>${t.gaps.slice(-12).map(gapCard).join('')}</section>`;
 if(phase==='recording')top+='<div class="gps-caution">Gardez l’application visible et l’écran allumé pendant les trajets. L’écran peut néanmoins s’éteindre selon les réglages du téléphone.</div>';
 }
 const rows=S.trips.filter(x=>x.phase==='validated').slice(0,20);
 top+=`<section class="section"><div class="section-title"><h2>Historique local</h2><span class="tag">${rows.length}</span></div>${rows.map(x=>`<div class="card gps-trip-row"><div><b>${htmlEscape(x.purpose||'Déplacement')}</b><small>${dateTime(x.startedAt)} · ${km((x.validatedKm??x.distanceM/1000)*1000)} km validés · ${x.gaps?.length||0} interruption(s)</small></div><div class="gps-row-actions"><span class="gps-sync-tag ${x.syncStatus==='sent'?'gps-sent':'gps-unsent'}">${x.syncStatus==='sent'?'✓ WAPILOT':x.syncStatus==='pending'?'⚠ À envoyer':'● Ancien essai local'}</span>${x.syncStatus!=='sent'?`<button type="button" data-gps-action="sync-one" data-id="${htmlEscape(x.id)}">${x.syncStatus==='pending'?'↻ Envoyer':'Transférer…'}</button>`:''}<button type="button" data-gps-action="gpx" data-id="${htmlEscape(x.id)}" aria-label="Exporter GPX">GPX</button><button type="button" data-gps-action="delete" data-id="${htmlEscape(x.id)}" aria-label="Effacer trajet local">×</button></div></div>`).join('')||'<div class="empty">Aucun déplacement validé sur ce téléphone.</div>'}<button class="primary wide" data-gps-action="sync-all" ${!rows.some(t=>t.syncStatus==='pending')||S.syncBusy?'disabled':''}>↻ Synchroniser les trajets en attente ${S.syncBusy?'…':''}</button><button class="secondary wide" data-gps-action="csv" ${rows.length?'':'disabled'}>⇩ Exporter mon relevé CSV</button><p class="footer-note">Les anciens essais V2.3 restent locaux tant que vous n’avez pas explicitement demandé leur transfert. Un trajet marqué ✓ WAPILOT apparaît dans Déplacements & km. Un trajet « À envoyer » existe uniquement sur ce téléphone : ne supprimez pas ses données. Le fichier GPX contient des coordonnées précises et n'est jamais transmis automatiquement.</p></section>`;
 return top;
 }
 async function action(type,id,endpoint){try{switch(type){case 'start':await start();break;case 'pause':await pause();break;case 'resume':await resume();break;case 'stop':await stop();break;case 'validate':await validate();break;case 'lookup-address':await resolveAddresses(S.current);break;case 'use-copro':await useCopro(endpoint,id);break;case 'sync-all':await syncPending();break;case 'sync-one':await syncTrip(id);break;case 'csv':await exportCSV();break;case 'gpx':await exportGPX(id);break;case 'delete':await removeTrip(id);break;}S.onChange()}catch(e){notice('Opération GPS non terminée : '+e.message)}}
 function hidden(){if(!S.current||S.current.phase!=='recording')return;if(document.hidden){S.hiddenAt=Date.now();releaseWake();}else{if(S.hiddenAt&&Date.now()-S.hiddenAt>10000){S.pendingHidden=true;S.current.gpsStatus='Retour à l’écran : vérification de l’interruption GPS';notice('Appel ou verrouillage possible : la portion manquante sera signalée.')}S.hiddenAt=null;requestWake();if(navigator.geolocation){navigator.geolocation.getCurrentPosition(queueFix,()=>{},{enableHighAccuracy:true,timeout:12000,maximumAge:0})}}}
 document.addEventListener('input',e=>{
  const t=S.current;if(t?.phase!=='review')return;
  if(/^gps-copro-search-(origin|destination)$/.test(e.target.id)){
   const which=e.target.id.endsWith('origin')?'origin':'destination',q=normalize(e.target.value),box=document.getElementById('gps-copro-results-'+which);if(!box)return;
   const matches=q.length>=2?(S.coprosFn?.()||[]).filter(c=>normalize(c.name+' '+(c.profile?.address||'')+' '+(c.profile?.postal_code||'')+' '+(c.profile?.city||'')).includes(q)&&postalAddr(c)).slice(0,5):[];
   box.innerHTML=matches.map(c=>`<button type="button" class="gps-copro-option" data-gps-action="use-copro" data-id="${htmlEscape(c.code)}" data-endpoint="${which}"><span><strong>${htmlEscape(c.name)}</strong><small>${htmlEscape(postalAddr(c))}</small></span><span class="gps-copro-choose">Utiliser</span></button>`).join('');return;
  }
  if(e.target.id==='gps-origin'||e.target.id==='gps-destination'){
   const which=e.target.id==='gps-origin'?'origin':'destination';t[which]=e.target.value;t[which+'ManuallyEdited']=true;
   t[which+'Source']='manual';t[which+'CoproName']='';t[which+'CoproCode']='';
  }else if(e.target.id==='gps-purpose')t.purpose=e.target.value;
  else if(e.target.id==='gps-km')t.reviewKm=e.target.value;
  else if(e.target.id==='gps-reason')t.reason=e.target.value;
 });
 document.addEventListener('change',e=>{if(S.current?.phase==='review'&&/^gps-(origin|destination|purpose|km|reason)$/.test(e.target.id))persist()});
 document.addEventListener('visibilitychange',hidden);
 window.addEventListener('pagehide',()=>{if(S.current?.phase==='recording')S.pendingHidden=true});
 window.addEventListener('online',()=>{if(S.uid)syncPending(true).catch(()=>{})});
 window.WapiGps={init,render,action,syncPending,stopMonitoring,suspendOnSignout,status:()=>({recording:S.current?.phase==='recording',pending:!!S.current}),onLoginChange:()=>S.onChange(),geoAvailable, _test:{meters,normalize:normalizedFix,rawState:S}};
})();
