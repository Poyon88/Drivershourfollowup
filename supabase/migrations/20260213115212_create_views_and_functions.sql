-- View: driver_period_summary
create view public.driver_period_summary
with (security_invoker = true)
as
select
  d.id as driver_id,
  d.code_salarie,
  d.vehicle_type,
  rp.id as period_id,
  rp.year,
  rp.period_number,
  rp.label as period_label,
  sum(mr.positive_hours) as total_positive_hours,
  sum(mr.missing_hours) as total_missing_hours,
  sum(mr.overtime_pay) as total_overtime_pay,
  (
    select mr2.counter_end 
    from public.monthly_records mr2 
    where mr2.driver_id = d.id 
      and mr2.period_id = rp.id 
    order by mr2.year desc, mr2.month desc 
    limit 1
  ) as latest_counter,
  max(mr.buffer_hours) as buffer_hours,
  count(mr.id) as months_recorded
from public.drivers d
join public.monthly_records mr on mr.driver_id = d.id
join public.reference_periods rp on rp.id = mr.period_id
group by d.id, d.code_salarie, d.vehicle_type, rp.id, rp.year, rp.period_number, rp.label;

-- Function: get_dashboard_stats
create or replace function public.get_dashboard_stats(
  p_period_id uuid,
  p_vehicle_type text default null
)
returns json
language plpgsql
security invoker
as $$
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
    join public.monthly_records mr on mr.driver_id = d.id and mr.period_id = p_period_id
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
       where mr3.driver_id = dl.id and mr3.period_id = p_period_id)
    ), 0),
    'critical_count', count(*) filter (where counter_end > buffer_hours * 0.8),
    'negative_count', count(*) filter (where counter_end < 0)
  ) into result
  from driver_latest dl;

  return coalesce(result, '{"total_drivers":0,"bus_count":0,"cam_count":0,"drivers_with_overtime":0,"total_overtime_pay":0,"critical_count":0,"negative_count":0}'::json);
end;
$$;

-- Function: get_counter_distribution
create or replace function public.get_counter_distribution(
  p_period_id uuid,
  p_vehicle_type text default null
)
returns table(bucket text, count bigint)
language plpgsql
security invoker
as $$
begin
  return query
  with latest_counters as (
    select distinct on (d.id)
      d.id as driver_id,
      d.vehicle_type,
      mr.counter_end
    from public.drivers d
    join public.monthly_records mr on mr.driver_id = d.id and mr.period_id = p_period_id
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
$$;
