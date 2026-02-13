import { createClient } from "@/lib/supabase/server";
import { DriverListClient } from "./driver-list-client";

interface Props {
  searchParams: Promise<{ period?: string; vehicle?: string }>;
}

export default async function DriversPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  // Parse period IDs (comma-separated) or fetch all
  let periodIds: string[] = [];
  if (params.period) {
    periodIds = params.period.split(",");
  } else {
    const { data: allPeriods } = await supabase
      .from("reference_periods")
      .select("id");
    periodIds = allPeriods?.map((p) => p.id) || [];
  }

  if (periodIds.length === 0) {
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
    .in("period_id", periodIds)
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
