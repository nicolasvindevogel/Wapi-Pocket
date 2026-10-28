# WAPI POCKET V3.0.3 — correctif logo non chargé sur GitHub/Cloudflare

## Correctifs
- Logo de l'écran de connexion et de l'en-tête incorporé directement dans `index.html`. Il n'a plus besoin du dossier `icons/` pour apparaître.
- Icônes PWA placées **à la racine du dépôt** : `wapi-pocket-icon-v303-192.png`, `wapi-pocket-icon-v303-512.png`, `wapi-pocket-maskable-v303-512.png`.
- Icônes Apple à la racine : `apple-touch-icon.png`, `apple-touch-icon-v303.png`, variantes 152/167 ; balises Apple mises à jour.
- Manifeste et service worker actualisés (V3.0.3), et URL de registration du SW versionnée pour renouveler les ressources.
- Fichiers métier `gps.js`, `mobile_modules.js`, `pocket_plus.js`, `styles.css` inchangés. `app.js` ne change que par l'URL de version du service worker.

## Publier correctement
1. Sauvegarder les fichiers et synchroniser tout trajet GPS ou visite locale avant toute suppression du raccourci mobile.
2. Ouvrir le ZIP et déposer **le contenu du ZIP à la racine** du dépôt GitHub utilisé par Cloudflare Pages, pas dans un sous-dossier supplémentaire. `index.html` et `apple-touch-icon.png` doivent être côte à côte.
3. Vérifier dans GitHub que les nouveaux fichiers PNG de la racine sont présents et committés. Attendre la fin du build/déploiement Cloudflare.
4. Ouvrir l'URL publique de WAPI POCKET dans Safari/Chrome, puis rafraîchir. Vérifier le logo sur la connexion et en haut de l'application.
5. Pour le raccourci **sur l'écran d'accueil iPhone** : après avoir synchronisé les données locales en attente, si l'ancienne icône persiste, supprimer **le raccourci uniquement**, puis ouvrir le site dans Safari et choisir Partager → Sur l'écran d'accueil → Ajouter. Ne pas effacer les données de Safari par réflexe.

## Vérifications rapides des URL sur la vraie adresse Cloudflare
- `https://<votre-site>/apple-touch-icon.png` doit afficher l'icône.
- `https://<votre-site>/wapi-pocket-icon-v303-192.png` doit afficher l'icône.
- `https://<votre-site>/manifest.webmanifest` doit renvoyer le manifeste JSON.

Ces chemins doivent être adaptés si WAPI POCKET est hébergée dans un sous-chemin. Les noms respectent la casse.

## Si le point d'interrogation persiste
Vérifier d'abord que le domaine ouvert est bien celui du nouveau déploiement. Essayer l'URL dans un onglet privé (l'icône de l'interface doit s'afficher même sans le dossier icons). Si le logo fonctionne en privé mais pas dans l'application installée, le problème est lié au cache/raccourci. Conserver toutes les données locales non synchronisées avant de réinstaller le raccourci.

Aucun SQL ni changement des Edge Functions/Supabase requis.
