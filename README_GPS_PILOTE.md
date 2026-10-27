# WAPI POCKET 2.3 — Prototype GPS professionnel (0 €)

## Portée exacte

Base : WAPI POCKET **V2.2 connectée**. Aucune modification du WAPILOT bureau, aucun nouveau SQL, aucun nouveau bucket, aucune Edge Function modifiée. Ce prototype n'écrit PAS dans le module Déplacements / KM de WAPILOT : c'est volontaire jusqu'à validation sur iPhone et Android réels.

## Utilisation

1. Publier les fichiers du ZIP GitHub WAPI POCKET sur une branche de prévisualisation de Cloudflare Pages (HTTPS). Conserver la V2.2 actuelle comme référence, et ne pas remplacer WAPILOT bureau.
2. Se connecter avec les identifiants habituels WAPILOT.
3. Appuyer sur **+ Actions → Nouveau trajet GPS → Démarrer**. Accorder la localisation précise à Safari ou Chrome (pour ce site) et laisser WAPI POCKET au premier plan.
4. Avant de conduire, démarrer ; ne pas manipuler le téléphone pendant la conduite.
5. Au retour, cliquer sur **Terminer**. Vérifier les kilomètres GPS et les éventuelles interruptions. Modifier le nombre de kilomètres uniquement avec une justification.
6. Cliquer sur **Valider localement**. Le trajet figure dans l'Historique local. Export CSV (relevé des trajets) ou GPX (positions GPS précises) possible, uniquement sur action de l'utilisateur.

## Ce qui fonctionne sans abonnement

- Suivi des positions successives avec `navigator.geolocation.watchPosition()` sous HTTPS et autorisation explicite.
- Addition de distances successives : départ = arrivée ne remet pas les kilomètres à zéro.
- Contrôles de précision (points >75 m écartés), filtrage des sauts GPS invraisemblables et faible déplacement.
- Détection des trous de plus de 30 secondes et des retours depuis l'arrière-plan / verrouillage (si le navigateur notifie l'événement).
- Aucune distance d'un trou n'est automatiquement ajoutée aux kilomètres confirmés : la distance « à vol d'oiseau » est affichée *uniquement comme indice*.
- Pauses, reprises, sauvegarde progressive dans IndexedDB, reprise manuelle après réouverture de la page, fermeture du trajet, validation distincte, export CSV/GPX.
- Wake Lock demandé si disponible pour essayer de maintenir l'écran allumé ; il peut être refusé, notamment par les réglages de batterie.
- Les données GPS restent localement sur le téléphone utilisé jusqu'à export ou suppression. Une suppression des données du site ou du raccourci peut les effacer ; le stockage local n'est pas une sauvegarde serveur.

## Limites IMPORTANTES

- **iPhone et Android : impossible de garantir la capture continue par PWA pendant un appel, un verrouillage ou un passage en arrière-plan.** Certaines portions peuvent manquer, y compris un aller-retour complet non détectable par les deux extrémités géographiques.
- Aucune API gratuite externe de routage n'a été intégrée : les serveurs OSRM/OpenStreetMap de démonstration n'ont pas de SLA, leur usage de production/commercial n'est pas garanti. Pas de reconstitution routière réelle pour cette V2.3.
- Le fichier GPX contient des données de localisation sensibles. Ne pas le partager hors du cadre de validation. Effacer les trajets de test sur le téléphone après vérification.
- Les trajets n'apparaissent **pas encore dans WAPILOT** ni dans le calcul des indemnités. Ne pas l'utiliser pour paie/indemnités tant que l'exactitude du pilote n'est pas validée.
- Le service worker ne met en cache que l'interface, pas les données personnelles Supabase. Les positions GPS sont conservées dans l'IndexedDB de ce navigateur et de cet appareil.
- Un changement de téléphone, la suppression des données du navigateur, l'utilisation d'un navigateur privé ou un nettoyage automatique peut supprimer l'historique local.

## Scénarios de vérification sur téléphones réels

- Aller-retour agence–résidence–agence, revenir au point GPS initial. Comparer avec le compteur de voiture.
- Appel mains libres Bluetooth de 5 minutes : vérifier l'interruption GPS, les km mesurés et le kilométrage corrigé.
- Écran verrouillé 5 minutes, puis retour : vérifier la reprise.
- Pause en parking, puis reprise.
- Réseau mobile coupé sans fermer la page : vérifier que les relevés locaux continuent.
- Fermer puis rouvrir WAPI POCKET pendant un trajet : la sauvegarde doit être retrouvée, mais le suivi doit être **repris manuellement**.
- Vérifier qu'aucune ligne n'est créée dans `wapi_mileage_entries` pendant ces tests.

## Publication

Ce ZIP doit remplacer **uniquement** les fichiers du dépôt GitHub WAPI POCKET V2.2 (pas WAPILOT). Les nouveaux fichiers sont `gps.js` et la nouvelle version de `app.js`, `index.html`, `styles.css` et `sw.js` (cache v2.3). Conserver la copie précédente pour retour arrière rapide.

Pas de SQL. Pas de clé API de routage. Pas de frais obligatoires dans les limites de l'hébergement Supabase/Cloudflare actuel. Pas de test GPS réel sur iPhone/Android réalisé ici.

## Contrôles internes

`node --check` sur app.js, gps.js et sw.js ; manifeste JSON analysé ; Chromium à largeur smartphone avec géolocalisation ET IndexedDB simulées : menu +, GPS démarré, positions cumulées, interruption >30 s, arrêt, validation corrigée et affichage dans l'historique. Ces essais ne constituent pas un test de réception GPS réel ou de durabilité IndexedDB en production.
