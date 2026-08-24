-- ============================================================================
--  VUE DES PÉRIODES DE ROSTER
-- ----------------------------------------------------------------------------
--  Déduire les périodes disponibles en lisant wp_employees ne fonctionne pas :
--  PostgREST plafonne une réponse à 1000 lignes, or un seul mois en compte plus
--  de 1400. La liste des périodes était donc tronquée au mois le plus récent,
--  et le tableau de bord annonçait « aucun roster » pour des mois pourtant
--  importés, en se rabattant sur juillet.
--
--  Cette vue ne renvoie qu'une ligne par période : la troncature devient sans
--  objet, quel que soit le volume de la table.
-- ============================================================================

CREATE OR REPLACE VIEW wp_employee_periods
WITH (security_invoker = true)
AS
SELECT DISTINCT annee, mois
FROM wp_employees;

GRANT SELECT ON wp_employee_periods TO authenticated, service_role;

COMMENT ON VIEW wp_employee_periods IS
  'Périodes de roster disponibles (une ligne par mois). À utiliser plutôt que de dériver les périodes depuis wp_employees, dont la lecture est plafonnée à 1000 lignes.';
