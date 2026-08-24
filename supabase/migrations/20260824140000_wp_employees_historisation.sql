-- ============================================================================
--  HISTORISATION DU ROSTER
-- ----------------------------------------------------------------------------
--  Jusqu'ici chaque import de roster VIDAIT wp_employees avant d'insérer : la
--  table ne contenait donc jamais qu'un seul mois, le dernier chargé. Le
--  tableau de bord calculait tous les mois depuis ce fichier unique, si bien
--  qu'un salarié parti en février disparaissait de janvier — l'export SIRH ne
--  reconduisant pas les sortis.
--
--  On aligne le roster sur le modèle déjà utilisé par les tables d'absences :
--  une période (mois, année), et un import qui ne remplace que sa période.
--
--  Reprise : les lignes existantes proviennent de SLA_stat_mensuelle_07.xlsx,
--  soit juillet 2026.
-- ============================================================================

ALTER TABLE wp_employees ADD COLUMN IF NOT EXISTS mois  SMALLINT;
ALTER TABLE wp_employees ADD COLUMN IF NOT EXISTS annee SMALLINT;

UPDATE wp_employees SET mois = 7, annee = 2026 WHERE mois IS NULL OR annee IS NULL;

ALTER TABLE wp_employees ALTER COLUMN mois  SET NOT NULL;
ALTER TABLE wp_employees ALTER COLUMN annee SET NOT NULL;

ALTER TABLE wp_employees DROP CONSTRAINT IF EXISTS wp_employees_mois_check;
ALTER TABLE wp_employees ADD  CONSTRAINT wp_employees_mois_check CHECK (mois BETWEEN 1 AND 12);

-- Un salarié n'apparaît qu'une fois par période.
CREATE UNIQUE INDEX IF NOT EXISTS wp_employees_code_periode_uniq
  ON wp_employees (code_salarie, annee, mois);

-- Le tableau de bord et les scénarios filtrent systématiquement sur la période.
CREATE INDEX IF NOT EXISTS wp_employees_periode_idx ON wp_employees (annee, mois);

COMMENT ON COLUMN wp_employees.mois IS
  'Mois de la photographie d''effectif. Un import de roster ne remplace que sa propre période.';
