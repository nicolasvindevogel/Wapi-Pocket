# Vérifications effectuées

- `node --check app.js` et `node --check sw.js` : OK.
- Exécution de rendus HTML des cinq écrans principaux dans Node VM avec données simulées : OK.
- Contrôles de filtrage copropriété/tâche et sinistre contre un cas de données interdite : OK ; une collision d'identifiants vides a été trouvée et corrigée avant livraison.
- Échappement HTML des textes : OK en simulation.
- Manifest JSON, icônes, chemins de fichiers relatifs pour GitHub Pages, absence de clé serveur : OK.
- Essai d'ouverture automatique dans Chromium : **bloqué par l'environnement d'exécution** (`ERR_BLOCKED_BY_ADMINISTRATOR`) ; aucune prétention de test navigateur complet.
- Supabase Auth, tables RLS, Edge Microsoft/Google, IndexedDB sur smartphone : **non testés en production**.
