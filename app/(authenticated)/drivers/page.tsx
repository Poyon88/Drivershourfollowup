import { createClient } from "@/lib/supabase/server";
import { DriverListClient } from "./driver-list-client";

interface Props {
  searchParams: Promise<{ period?: string; vehicle?: string }>;
}

export default async function DriversPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  // Get latest period if none selected
  let periodId = params.period;
  if (!periodId) {
    const { data: latestPeriod } = await supabase
      .from("reference_periods")
      .select("id")
      .order("year", { ascending: false })
      .order("period_number", { ascending: false })
      .limit(1)
      .single();
    periodId = latestPeriod?.id;
  }

  if (!periodId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Conducteurs</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-lg font-medium">Aucune donnée disponible</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Importez un fichier Excel pour commencer.
          </p>
        </div>
      </div>
    );
  }

  const vehicleType = params.vehicle === "BUS" || params.vehicle === "CAM" ? params.vehicle : null;

  let query = supabase
    .from("driver_period_summary")
    .select("*")
    .eq("period_id", periodId)
    .order("code_salarie");

  if (vehicleType) {
    query = query.eq("vehicle_type", vehicleType);
  }

  const { data: drivers } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conducteurs</h1>
        <p className="text-muted-foreground">
          Liste de tous les conducteurs avec leurs indicateurs
        </p>
      </div>
      <DriverListClient drivers={drivers || []} />
    </div>
  );
}
