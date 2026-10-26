-- WAPI POCKET 2.1 — Préparation du champ multi-photos.
-- À exécuter UNE FOIS dans le SQL Editor du projet Supabase WAPILOT.
-- Ne crée aucune nouvelle copropriété, ne supprime ni ne réécrit aucune note existante.
-- L'ancien schéma possédait photo_url, photo_path et photo_name : conservés.

ALTER TABLE IF EXISTS public.web_pocket_notes
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Aucun changement de policy RLS ni de bucket Storage.
-- IMPORTANT : le bucket existant syndic-files doit autoriser les utilisateurs
-- connectés à écrire dans pocket/<auth.uid()>/... selon les policies en place.
-- Les liens publics existants (getPublicUrl) ne fonctionnent que si le bucket
-- et sa politique d'accès l'autorisent : vérifier la confidentialité.
