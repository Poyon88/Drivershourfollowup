-- ============================================================================
--  NOM DU SALARIÉ DANS LE ROSTER
-- ----------------------------------------------------------------------------
--  Les sections « Départs identifiés » et « Arrivées identifiées » n'affichaient
--  que le matricule : l'export SLA_stat_mensuelle_* ne comporte aucune colonne
--  d'identité, et wp_employees n'avait donc nulle part où la stocker.
--
--  La colonne reste NULLABLE : tant que l'export ne fournit pas le nom, le
--  parseur laisse le champ vide et l'interface se rabat sur le matricule.
--  Aucune reprise de données n'est nécessaire — le prochain import de roster
--  remplace intégralement la table.
-- ============================================================================

ALTER TABLE wp_employees ADD COLUMN IF NOT EXISTS nom_salarie TEXT;

COMMENT ON COLUMN wp_employees.nom_salarie IS
  'Nom du salarié, alimenté par la colonne « Nom » de l''export roster si elle est présente. Donnée personnelle : ne pas exposer hors des vues authentifiées.';
