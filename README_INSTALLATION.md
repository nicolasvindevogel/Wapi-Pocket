# WAPI POCKET 2.0 — première version connectée à WAPILOT

Version : **2.0.0-beta1** — projet autonome GitHub Pages / Cloudflare Pages.

## Installation via GitHub et Cloudflare

1. Créer un **nouveau dépôt GitHub** (ex. `WAPI-POCKET-2`) : ne pas réutiliser le dépôt de WAPILOT.
2. Déposer **le contenu** de cette archive à la **racine** du dépôt : `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, dossier `icons`.
3. Choix A : GitHub → **Settings → Pages → Deploy from a branch → main → /(root)**. Un site de projet aura une URL du type `https://<utilisateur>.github.io/WAPI-POCKET-2/`.
4. Choix B (recommandé si vous souhaitez Cloudflare) : Cloudflare → **Workers & Pages → Create → Pages → Connect to Git → sélectionner le NOUVEAU dépôt**. Projet statique : pas de commande de build, répertoire de sortie `./` (racine). Cloudflare attribue alors un lien `*.pages.dev`. Vous pouvez utiliser Github comme dépôt source **sans activer Github Pages**.
5. Ouvrir le lien **HTTPS**, puis installer la PWA : iPhone Safari → Partager → Sur l'écran d'accueil ; Android Chrome → Installer.
6. Garder WAPILOT inchangé pendant les premiers tests. Créer une tâche de test dans Pocket puis vérifier qu'elle existe dans WAPILOT.

**Important :** lors des mises à jour, remplacer les fichiers puis augmenter `CACHE` dans `sw.js` pour forcer le rafraîchissement de l'interface installée. Ne pas effacer les données du navigateur d'un appareil possédant des captures locales non encore transmises.

## Connexion, sécurité et intégrations

- Authentification via **le même Supabase Auth** que WAPILOT : e-mail et mot de passe existants, sans créer d'autres utilisateurs.
- Code utilise seulement la **clé publiable**, déjà utilisée dans le client WAPILOT. **Aucune clé service_role** ne doit figurer sur Github.
- Lecture du profil `user_profiles`. Comptes désactivés ou sans profil : accès refusé.
- Affectations `user_copros` et liste `web_copros` : filtrage par résidence ; les droits réels doivent aussi être appliqués dans **Supabase RLS**.
- Tâches `web_tasks_new` : consultation + création + passage « En cours », refus/erreur clairement affiché. Historique transmis au format WAPILOT.
- Sinistres `web_sinistres` : consultation de base.
- Prévention incendie `wp_fire_cases`, ascenseurs `wp_lifts`, mutations `web_notaire_requests`, AG `web_ags`, DL TECHNIK `technik_v_interventions` : **consultation ciblée uniquement** depuis la fiche copropriété ; RLS et noms réels des colonnes contrôlent le résultat.
- Microsoft 365 : Edge Function **`wapilot-microsoft-mail`**, actions `mailboxes`, `messages`, `message`, `send`. **Ne pas** remplacer cette fonction par `wapilot-sinistre-mail`.
- Google Calendar : Edge Function **`wapilot-google-calendar`**, action `events`.
- Captures : photos et brouillons stockés uniquement **localement** dans IndexedDB sur le téléphone. Texte transmis sur commande dans `web_pocket_notes` (table de WAPILOT) si l'accès le permet.

**Limites de cette version beta, à corriger avant une utilisation générale sur chantier :**

1. Les **photos NE SONT PAS encore envoyées à Supabase/WAPILOT**. Leur conservation locale est uniquement une mesure transitoire, non une sauvegarde d'entreprise. Vérifier le stockage photo privé et ses autorisations avant de développer la synchronisation. Ne pas effacer l'application si elle contient des photos importantes.
2. Fonctionnement hors ligne : l'interface statique se met en cache, et les captures sont enregistrables **si la session a déjà ouvert l'application**. Une reconnexion complète hors ligne ou la récupération de données métier hors ligne n'est pas garantie.
3. Le **bouton « Nouveau message à cet expéditeur » crée un e-mail distinct** ; une vraie réponse en fil de conversation Microsoft 365 doit être raccordée ultérieurement.
4. Les modules métiers secondaires sont en **lecture simplifiée**. Les formulaires complets restent dans WAPILOT.
5. Les tests réalisés ici sont des vérifications de syntaxe et de logique avec données simulées ; **aucune requête à Supabase/Graph réelle et aucun essai iPhone/Android n'ont été effectués**.
6. Les données chargées sont limitées volontairement afin de préserver la réactivité (350 tâches récentes et 150 sinistres). Les archives ne sont donc pas exhaustives dans Pocket.
7. Un compte peut avoir besoin d'autorisations RLS spécifiques pour certains modules. Corriger la politique serveur de manière ciblée, ne jamais ouvrir la table à tous pour contourner un refus.

## Fichiers

- `index.html` : structure statique.
- `styles.css` : interface mobile, tailles tactiles et barres iOS/Android.
- `app.js` : navigation, intégrations WAPILOT/Supabase et stockage local.
- `manifest.webmanifest`, `icons/`, `sw.js` : installation PWA et ressources statiques hors ligne.

## Validation progressive

1. Connexion avec un compte WAPILOT test autorisé, puis avec un compte sans accès à certaines résidences.
2. Vérifier qu'aucune résidence interdite n'apparaît ; vérifier les noms semblables et les copropriétés fusionnées.
3. Consulter une tâche, créer une tâche fictive, puis vérifier sa réception dans WAPILOT.
4. Consulter une boîte Microsoft 365, puis envoyer un e-mail de test à sa propre adresse (confirmation manuelle explicite).
5. Tester l'agenda Google et l'ouverture d'un dossier sinistre ou ascenseur.
6. Photographier hors ligne, revenir sur la capture, puis restaurer la connexion. **Ne pas interpréter la présence de la photo en local comme un transfert effectué.**

Un problème d'accès doit être investigué côté RLS/Edge Function. **Ne jamais publier de secrets dans le dépôt GitHub.**
