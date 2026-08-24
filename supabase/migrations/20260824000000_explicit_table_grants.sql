-- ============================================================================
--  PRIVILÈGES EXPLICITES SUR LE SCHÉMA PUBLIC
-- ----------------------------------------------------------------------------
--  Jusqu'ici, aucune migration ne posait de GRANT : le schéma s'appuyait sur
--  les "default privileges" permissifs des projets Supabase créés avant le
--  durcissement de 2026. Le projet de production en bénéficie (créé en février
--  2026), mais un projet NEUF reconstruit depuis ces migrations produit une
--  base où `authenticated` n'a aucun droit DML — l'application échoue alors sur
--  « permission denied for table wp_imports ».
--
--  Cette migration rend le dépôt rejouable de zéro. Elle est idempotente et
--  sans effet sur la production, où ces privilèges existent déjà.
--
--  Portée volontairement plus étroite que l'état de la production : on
--  n'accorde RIEN à `anon`. Toutes les policies RLS de ce schéma ciblent
--  `authenticated`, donc `anon` n'a de toute façon accès à aucune ligne ; lui
--  retirer les privilèges de table supprime le risque qu'une policy future
--  écrite `to public` l'expose par inadvertance. Les GRANT déjà présents en
--  production ne sont pas révoqués — cette migration n'ajoute jamais rien à
--  `anon`, elle ne lui reprend rien non plus.
--
--  La RLS reste le mécanisme d'autorisation : elle est active sur toutes les
--  tables et un GRANT ne contourne aucune policy.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO authenticated, service_role;

-- Objets créés par les migrations futures
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
