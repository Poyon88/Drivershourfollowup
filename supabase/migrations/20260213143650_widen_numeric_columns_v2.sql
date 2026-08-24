-- Drop view that depends on these columns
drop view if exists public.driver_period_summary;

-- Widen numeric columns to unrestricted precision
alter table public.monthly_records
  alter column buffer_hours type numeric,
  alter column positive_hours type numeric,
  alter column missing_hours type numeric,
  alter column overtime_pay type numeric,
  alter column counter_end type numeric;

-- Recreate view
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
