"use server";

import { createClient } from "@/lib/supabase/server";

export async function clearAllData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // Delete in order respecting foreign key constraints
  // 1. monthly_records (references drivers, imports, reference_periods)
  const { error: e1 } = await supabase
    .from("monthly_records")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) throw new Error("Erreur suppression monthly_records: " + e1.message);

  // 2. imports (references reference_periods)
  const { error: e2 } = await supabase
    .from("imports")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) throw new Error("Erreur suppression imports: " + e2.message);

  // 3. drivers
  const { error: e3 } = await supabase
    .from("drivers")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e3) throw new Error("Erreur suppression drivers: " + e3.message);

  // 4. reference_periods
  const { error: e4 } = await supabase
    .from("reference_periods")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e4) throw new Error("Erreur suppression reference_periods: " + e4.message);

  return { success: true };
}
