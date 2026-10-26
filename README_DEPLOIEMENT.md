# WAPI POCKET 2.1 — Livraison GitHub / Cloudflare Pages

## Base et changements

Cette version part de WAPI POCKET 2.0 connecté, conserve Supabase Auth et les profils WAPILOT, le filtre des copropriétés, Ma journée, les tâches, la fiche copropriété et les modules métier en consultation. Aucun fichier WAPILOT sur ordinateur n’est remplacé.

- Icône : symbole SVG exact extrait de la marque WAPILOT (carré vert avec W et flèche), rendu en PNG aux dimensions iPhone/Android, utilisé dans l’interface et le manifeste.
- Capture : caméra intégrée via `getUserMedia` lorsque HTTPS + navigateur le permettent ; bouton de repli vers l’appareil photo natif (`capture=environment`) ; choix de plusieurs photos depuis la galerie.
- Enregistrement : envoi immédiat dans `syndic-files/pocket/<user_id>/<note_id>/...` puis insertion de la note et de ses métadonnées dans `web_pocket_notes`, pour le module Notes terrain WAPILOT. Aucune nouvelle note n’est placée dans une file IndexedDB. La saisie est conservée uniquement à l’écran tant qu’elle est ouverte si l’envoi échoue. L’original de la photo n’est pas effacé du téléphone.
- En cas de timeout, la note possède un identifiant stable pendant le nouvel essai et l’application interroge Supabase avant une deuxième insertion. Aucun échec réseau n’est affiché comme un succès. Les photos orphelines éventuellement créées par un échec partiel ne sont jamais effacées aveuglément.
- Messagerie : boîtes, dossiers, recherche Microsoft Graph, non-lus, pagination, consultation, marquage lu/non-lu, déplacement, archivage, suppression confirmée, création de message, brouillon, réponse/réponse à tous/transfert, Cc/Cci et téléchargement de pièces jointes.

## Ordre de déploiement

1. Conserver une copie du ZIP de WAPI POCKET 2.0 déjà publié.
2. Dans le projet Supabase de **WAPILOT**, ouvrir SQL Editor. Vérifier que `public.web_pocket_notes` existe ; exécuter le fichier `01_SUPABASE_PHOTOS_NON_DESTRUCTIF.sql`. Il ajoute uniquement la colonne JSONB `photos` si elle manque. Il ne touche à aucune règle RLS, ni aux autres colonnes.
3. Dans Supabase > Storage, vérifier que le bucket déjà utilisé par l’ancien WAPI POCKET est bien `syndic-files`, qu’un utilisateur connecté peut y écrire dans `pocket/<son_user_id>/`, et que les URL sont lisibles depuis WAPILOT. **Ne pas rendre le bucket public seulement pour contourner un message d’erreur** : si les accès diffèrent du mécanisme historique, corriger la politique précisément avant le déploiement.
4. GitHub : dans le dépôt WAPI POCKET 2 (et non WAPILOT), remplacer `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, et le dossier `icons/`. Le contenu du ZIP `GITHUB_CLOUDFLARE.zip` comprend les seuls fichiers statiques destinés à la publication. **Ne pas publier le SQL dans une URL de production** ; le SQL n’est inclus que dans le pack source/installation séparé.
5. Si Cloudflare Pages est relié à cette branche GitHub, attendre un déploiement **Success**. Recharger la PWA, éventuellement la fermer/réouvrir pour mettre à jour le Service Worker. Les icônes iOS mises en cache peuvent exiger de supprimer puis recréer uniquement le raccourci (ne pas vider le stockage utilisateur sans vérification).

## Vérifications conseillées sur un vrai téléphone

1. Connexion avec un compte WAPILOT et vérification des copropriétés autorisées.
2. Bouton **Prendre une photo** → prévisualisation caméra, capture et ajout à la note ; repli natif iOS/Android si l’API caméra n’est pas accessible.
3. Bouton **Choisir des photos** → galerie et sélection multiple.
4. Note avec deux photos → **Envoyer à WAPILOT** → vérifier l’apparition d’une seule note et des deux photos dans **WAPILOT > Notes terrain**.
5. Simulation de réseau coupé : le bouton doit indiquer l’échec, sans effacer la saisie ni prétendre que les photos ont été enregistrées.
6. Test Microsoft 365 : dossiers Réception / Envoyés / Archives, recherche, lecture, réponse **dans le fil**, pièce jointe, création d’un brouillon et déplacement, avec messages de test.
7. Vérifier les droits de deux collaborateurs distincts.

## Précautions / limites

- La création de brouillon fonctionne avec l’Edge Function existante ; la modification d’un **brouillon existant** n’a pas été ajoutée faute de contrat serveur confirmé.
- La caméra dépend des permissions et restrictions de Safari/Chrome et de la disponibilité HTTPS. Les tests ont été simulés dans Chromium ; aucun iPhone ou Android réel n’a été testé ici.
- Les photos sont transmises vers le bucket historique utilisé par WAPILOT. Si ce bucket n’autorise pas l’opération via la session utilisateur ou si ses liens sont privés, une adaptation ciblée de Storage / de la lecture des documents peut être nécessaire ; **ne pas élargir les droits du bucket aveuglément**.
- Les transferts ne sont pas repris en arrière-plan après fermeture, volontairement selon la demande : aucune file d’attente locale n’est conservée.
- Le service Microsoft 365 actuel accepte plusieurs actions ; leur autorisation reste gérée côté Edge Function. La sécurité côté navigateur ne remplace jamais une permission serveur. Ne pas modifier `wapilot-microsoft-mail` ni `wapilot-sinistre-mail` pour ce déploiement.
- Les documents autres que les images ne sont pas encore intégrés à l’outil de capture. La saisie des notes textuelles et des photographies est opérationnelle sous réserve des droits Supabase.
- Aucun envoi, authentification ou test Storage réel n’a été exécuté sur le projet Supabase de production.

## Retour arrière

Rétablir les fichiers du ZIP WAPI POCKET 2.0 sur le dépôt GitHub ; la colonne `photos` ajoutée à Supabase est additive et ne doit pas être supprimée pour effectuer le retour arrière. Le site WAPILOT principal est inchangé.
