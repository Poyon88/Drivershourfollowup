import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import AnalyticsClient from "./analytics-client";
import { FRENCH_MONTHS_SHORT } from "@/lib/constants";
import { getDriverStatus } from "@/lib/utils/status-helpers";

interface Props {
  searchParams: Promise<{ period?: string; vehicle?: string }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
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
        <div>
          <h1 className="text-2xl font-bold">Analytique</h1>
          <p className="text-muted-foreground">
            Graphiques et tendances des heures excédentaires
          </p>
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

  const vehicleType =
    params.vehicle === "BUS" || params.vehicle === "CAM"
      ? params.vehicle
      : null;

  // 1. Counter distribution (average per driver across selected periods)
  let distQuery = supabase
    .from("driver_period_summary")
    .select("driver_id, code_salarie, vehicle_type, latest_counter")
    .in("period_id", periodIds)
    .limit(50000);

  if (vehicleType) {
    distQuery = distQuery.eq("vehicle_type", vehicleType);
  }

  const { data: distData } = await distQuery;

  // Group by driver and compute average latest_counter
  const driverAvgMap = new Map<
    string,
    { driverId: string; codeSalarie: string; vehicleType: string; values: number[] }
  >();
  (distData || []).forEach((d) => {
    const existing = driverAvgMap.get(d.driver_id);
    if (existing) {
      existing.values.push(Number(d.latest_counter));
    } else {
      driverAvgMap.set(d.driver_id, {
        driverId: d.driver_id,
        codeSalarie: d.code_salarie,
        vehicleType: d.vehicle_type,
        values: [Number(d.latest_counter)],
      });
    }
  });

  const BUCKET_ORDER = ["< -10h", "-10h à 0h", "0h à 5h", "5h à 10h", "10h à 15h", "> 15h"];
  const BUCKET_RANGES: Record<string, { min: number; max: number }> = {
    "< -10h": { min: -Infinity, max: -10 },
    "-10h à 0h": { min: -10, max: 0 },
    "0h à 5h": { min: 0, max: 5 },
    "5h à 10h": { min: 5, max: 10 },
    "10h à 15h": { min: 10, max: 15 },
    "> 15h": { min: 15, max: Infinity },
  };

  function getBucket(value: number): string {
    for (const bucket of BUCKET_ORDER) {
      const range = BUCKET_RANGES[bucket];
      if (
        (range.min === -Infinity || value >= range.min) &&
        (range.max === Infinity || value < range.max)
      ) {
        return bucket;
      }
    }
    return "> 15h";
  }

  // Build per-driver averages and distribution buckets
  const driverAverages: { driverId: string; codeSalarie: string; vehicleType: string; avgCounter: number }[] = [];
  const bucketCounts = new Map<string, number>();
  BUCKET_ORDER.forEach((b) => bucketCounts.set(b, 0));

  driverAvgMap.forEach((d) => {
    const avg = d.values.reduce((a, b) => a + b, 0) / d.values.length;
    driverAverages.push({
      driverId: d.driverId,
      codeSalarie: d.codeSalarie,
      vehicleType: d.vehicleType,
      avgCounter: avg,
    });
    const bucket = getBucket(avg);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
  });

  const distribution = BUCKET_ORDER
    .map((bucket) => ({ bucket, count: bucketCounts.get(bucket) || 0 }))
    .filter((d) => d.count > 0);

  // 2. Monthly average evolution
  let monthQuery = supabase
    .from("monthly_records")
    .select(
      "month, year, counter_end, driver_id, drivers!inner(vehicle_type)"
    )
    .in("period_id", periodIds)
    .order("year")
    .order("month")
    .limit(50000);

  if (vehicleType) {
    monthQuery = monthQuery.eq("drivers.vehicle_type", vehicleType);
  }

  const { data: monthlyData } = await monthQuery;

  let monthlyAvg: { name: string; moyenne: number }[] = [];
  if (monthlyData) {
    const grouped = new Map<string, number[]>();
    monthlyData.forEach((r) => {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(Number(r.counter_end));
    });

    monthlyAvg = Array.from(grouped.entries())
      .sort()
      .map(([key, values]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          name: `${FRENCH_MONTHS_SHORT[month]} ${year}`,
          moyenne: values.reduce((a, b) => a + b, 0) / values.length,
        };
      });
  }

  // 3. Period comparison (server-side aggregation via RPC)
  const { data: comparisonRaw } = await supabase.rpc("get_period_comparison", {
    p_period_ids: periodIds,
    p_vehicle_type: vehicleType,
  });

  const periodComparison = (comparisonRaw || []).map(
    (d: Record<string, unknown>) => ({
      periodId: String(d.period_id),
      periodLabel: String(d.period_label),
      year: Number(d.year),
      periodNumber: Number(d.period_number),
      totalDrivers: Number(d.total_drivers),
      totalOvertimePay: Number(d.total_overtime_pay),
      totalPositiveEnd: Number(d.total_positive_end),
      driversPositive: Number(d.drivers_positive),
      totalMissingEnd: Number(d.total_missing_end),
      driversNegative: Number(d.drivers_negative),
    })
  );

  // 4. Status breakdown
  let summaryQuery = supabase
    .from("driver_period_summary")
    .select("latest_counter, buffer_hours, total_overtime_pay")
    .in("period_id", periodIds)
    .limit(10000);

  if (vehicleType) {
    summaryQuery = summaryQuery.eq("vehicle_type", vehicleType);
  }

  const { data: summaryData } = await summaryQuery;

  const statusCounts = { green: 0, orange: 0, red: 0 };
  (summaryData || []).forEach((d) => {
    const status = getDriverStatus(
      Number(d.latest_counter),
      Number(d.buffer_hours),
      Number(d.total_overtime_pay) > 0
    );
    statusCounts[status]++;
  });

  const STATUS_COLORS = {
    green: "#22c55e",
    orange: "#f59e0b",
    red: "#ef4444",
  };
  const STATUS_LABELS = {
    green: "Normal",
    orange: "Attention",
    red: "Critique",
  };

  const statusBreakdown = (
    Object.entries(statusCounts) as [keyof typeof statusCounts, number][]
  )
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key],
      value,
      fill: STATUS_COLORS[key],
    }));

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted-foreground">
          Chargement...
        </div>
      }
    >
      <AnalyticsClient
        distribution={distribution}
        driverAverages={driverAverages}
        monthlyAvg={monthlyAvg}
        periodComparison={periodComparison}
        statusBreakdown={statusBreakdown}
      />
    </Suspense>
  );
}
