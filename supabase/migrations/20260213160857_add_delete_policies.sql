CREATE POLICY "Authenticated users can delete drivers"
  ON drivers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete imports"
  ON imports FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete reference_periods"
  ON reference_periods FOR DELETE TO authenticated USING (true);
