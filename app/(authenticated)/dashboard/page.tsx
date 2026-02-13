import { createClient } from "@/lib/supabase/server";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CounterDistributionChart } from "@/components/dashboard/counter-distribution-chart";
import { OvertimePayList } from "@/components/dashboard/overtime-pay-list";

interface Props {
  searchParams: Promise<{ period?: string; vehicle?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
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
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d&apos;ensemble des heures excédentaires</p>
        </div>
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

  // Fetch dashboard stats
  const { data: stats } = await supabase.rpc("get_dashboard_stats", {
    p_period_id: periodId,
    p_vehicle_type: vehicleType,
  });

  // Fetch counter distribution
  const { data: distribution } = await supabase.rpc("get_counter_distribution", {
    p_period_id: periodId,
    p_vehicle_type: vehicleType,
  });

  // Fetch drivers with overtime pay
  let overtimeQuery = supabase
    .from("driver_period_summary")
    .select("driver_id, code_salarie, vehicle_type, total_overtime_pay, latest_counter")
    .eq("period_id", periodId)
    .gt("total_overtime_pay", 0)
    .order("total_overtime_pay", { ascending: false })
    .limit(20);

  if (vehicleType) {
    overtimeQuery = overtimeQuery.eq("vehicle_type", vehicleType);
  }

  const { data: overtimeDrivers } = await overtimeQuery;

  const defaultStats = {
    total_drivers: 0,
    bus_count: 0,
    cam_count: 0,
    drivers_with_overtime: 0,
    total_overtime_pay: 0,
    critical_count: 0,
    negative_count: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble des heures excédentaires</p>
      </div>

      <KpiCards stats={stats || defaultStats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CounterDistributionChart data={distribution || []} />
        <OvertimePayList drivers={overtimeDrivers || []} />
      </div>
    </div>
  );
}
