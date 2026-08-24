-- Replace get_dashboard_stats to accept UUID array
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_period_ids uuid[], p_vehicle_type text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  result json;
begin
  with driver_latest as (
    select distinct on (d.id)
      d.id,
      d.vehicle_type,
      mr.counter_end,
      mr.overtime_pay,
      mr.buffer_hours
    from public.drivers d
    join public.monthly_records mr on mr.driver_id = d.id and mr.period_id = ANY(p_period_ids)
    where (p_vehicle_type is null or d.vehicle_type = p_vehicle_type)
    order by d.id, mr.year desc, mr.month desc
  )
  select json_build_object(
    'total_drivers', count(*),
    'bus_count', count(*) filter (where vehicle_type = 'BUS'),
    'cam_count', count(*) filter (where vehicle_type = 'CAM'),
    'drivers_with_overtime', count(*) filter (where overtime_pay > 0),
    'total_overtime_pay', coalesce(sum(
      (select sum(mr3.overtime_pay) from public.monthly_records mr3 
       where mr3.driver_id = dl.id and mr3.period_id = ANY(p_period_ids))
    ), 0),
    'critical_count', count(*) filter (where counter_end > buffer_hours * 0.8),
    'negative_count', count(*) filter (where counter_end < 0)
  ) into result
  from driver_latest dl;

  return coalesce(result, '{"total_drivers":0,"bus_count":0,"cam_count":0,"drivers_with_overtime":0,"total_overtime_pay":0,"critical_count":0,"negative_count":0}'::json);
end;
$function$;

-- Drop old single-param version
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, text);

-- Replace get_counter_distribution to accept UUID array
CREATE OR REPLACE FUNCTION public.get_counter_distribution(p_period_ids uuid[], p_vehicle_type text DEFAULT NULL::text)
RETURNS TABLE(bucket text, count bigint)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  return query
  with latest_counters as (
    select distinct on (d.id)
      d.id as driver_id,
      d.vehicle_type,
      mr.counter_end
    from public.drivers d
    join public.monthly_records mr on mr.driver_id = d.id and mr.period_id = ANY(p_period_ids)
    where (p_vehicle_type is null or d.vehicle_type = p_vehicle_type)
    order by d.id, mr.year desc, mr.month desc
  )
  select
    case
      when lc.counter_end < -10 then '< -10h'
      when lc.counter_end >= -10 and lc.counter_end < 0 then '-10h à 0h'
      when lc.counter_end >= 0 and lc.counter_end < 5 then '0h à 5h'
      when lc.counter_end >= 5 and lc.counter_end < 10 then '5h à 10h'
      when lc.counter_end >= 10 and lc.counter_end < 15 then '10h à 15h'
      else '> 15h'
    end as bucket,
    count(*)::bigint as count
  from latest_counters lc
  group by 1
  order by min(lc.counter_end);
end;
$function$;

-- Drop old single-param version
DROP FUNCTION IF EXISTS public.get_counter_distribution(uuid, text);
