create policy "Authenticated users can update monthly_records"
  on public.monthly_records for update to authenticated using (true) with check (true);
