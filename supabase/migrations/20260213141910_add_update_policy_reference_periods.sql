create policy "Authenticated users can update reference_periods"
  on public.reference_periods for update to authenticated using (true) with check (true);
