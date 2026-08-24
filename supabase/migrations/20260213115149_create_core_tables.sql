-- Table: reference_periods
create table public.reference_periods (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  period_number smallint not null check (period_number in (1, 2, 3)),
  label text not null,
  start_month smallint not null,
  end_month smallint not null,
  created_at timestamptz not null default now(),
  constraint unique_year_period unique (year, period_number)
);

-- Table: imports
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  period_id uuid not null references public.reference_periods(id) on delete cascade,
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  error_message text
);

-- Table: drivers
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  code_salarie text not null unique,
  vehicle_type text not null check (vehicle_type in ('BUS', 'CAM')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_drivers_vehicle_type on public.drivers(vehicle_type);
create index idx_drivers_code_salarie on public.drivers(code_salarie);

-- Table: monthly_records
create table public.monthly_records (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  period_id uuid not null references public.reference_periods(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  buffer_hours numeric(8,2) not null default 0,
  positive_hours numeric(8,2) not null default 0,
  missing_hours numeric(8,2) not null default 0,
  overtime_pay numeric(10,2) not null default 0,
  counter_end numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint unique_driver_month_period unique (driver_id, period_id, month, year)
);

create index idx_monthly_records_driver on public.monthly_records(driver_id);
create index idx_monthly_records_period on public.monthly_records(period_id);
create index idx_monthly_records_driver_period on public.monthly_records(driver_id, period_id);
create index idx_monthly_records_month_year on public.monthly_records(year, month);

-- Enable RLS
alter table public.reference_periods enable row level security;
alter table public.imports enable row level security;
alter table public.drivers enable row level security;
alter table public.monthly_records enable row level security;

-- RLS Policies
create policy "Authenticated users can read reference_periods"
  on public.reference_periods for select to authenticated using (true);

create policy "Authenticated users can insert reference_periods"
  on public.reference_periods for insert to authenticated with check (true);

create policy "Authenticated users can read imports"
  on public.imports for select to authenticated using (true);

create policy "Authenticated users can insert imports"
  on public.imports for insert to authenticated with check (true);

create policy "Authenticated users can update imports"
  on public.imports for update to authenticated using (true);

create policy "Authenticated users can read drivers"
  on public.drivers for select to authenticated using (true);

create policy "Authenticated users can insert drivers"
  on public.drivers for insert to authenticated with check (true);

create policy "Authenticated users can update drivers"
  on public.drivers for update to authenticated using (true);

create policy "Authenticated users can read monthly_records"
  on public.monthly_records for select to authenticated using (true);

create policy "Authenticated users can insert monthly_records"
  on public.monthly_records for insert to authenticated with check (true);

create policy "Authenticated users can delete monthly_records"
  on public.monthly_records for delete to authenticated using (true);
