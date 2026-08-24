CREATE OR REPLACE FUNCTION get_period_comparison(
  p_period_ids uuid[],
  p_vehicle_type text DEFAULT NULL
)
RETURNS TABLE(
  period_id uuid,
  period_label text,
  year integer,
  period_number smallint,
  total_drivers bigint,
  total_overtime_pay numeric,
  total_positive_end numeric,
  drivers_positive bigint,
  total_missing_end numeric,
  drivers_negative bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dps.period_id,
    dps.period_label,
    dps.year,
    dps.period_number,
    COUNT(*)::bigint AS total_drivers,
    COALESCE(SUM(dps.total_overtime_pay), 0) AS total_overtime_pay,
    COALESCE(SUM(CASE WHEN dps.latest_counter > 0 THEN dps.latest_counter ELSE 0 END), 0) AS total_positive_end,
    COUNT(CASE WHEN dps.latest_counter > 0 THEN 1 END)::bigint AS drivers_positive,
    COALESCE(SUM(CASE WHEN dps.latest_counter < 0 THEN ABS(dps.latest_counter) ELSE 0 END), 0) AS total_missing_end,
    COUNT(CASE WHEN dps.latest_counter < 0 THEN 1 END)::bigint AS drivers_negative
  FROM driver_period_summary dps
  WHERE dps.period_id = ANY(p_period_ids)
    AND (p_vehicle_type IS NULL OR dps.vehicle_type = p_vehicle_type)
  GROUP BY dps.period_id, dps.period_label, dps.year, dps.period_number
  ORDER BY dps.year, dps.period_number;
END;
$$;
