"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { FRENCH_MONTHS_SHORT } from "@/lib/constants";
import { getDriverStatus } from "@/lib/utils/status-helpers";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const BUCKET_RANGES: Record<string, { min: number; max: number }> = {
  "< -10h": { min: -Infinity, max: -10 },
  "-10h à 0h": { min: -10, max: 0 },
  "0h à 5h": { min: 0, max: 5 },
  "5h à 10h": { min: 5, max: 10 },
  "10h à 15h": { min: 10, max: 15 },
  "> 15h": { min: 15, max: Infinity },
};

interface BucketDriver {
  driverId: string;
  codeSalarie: string;
  vehicleType: string;
  latestCounter: number;
}

const BUCKET_COLORS: Record<string, string> = {
  "< -10h": "#6366f1",
  "-10h à 0h": "#3b82f6",
  "0h à 5h": "#22c55e",
  "5h à 10h": "#eab308",
  "10h à 15h": "#f97316",
  "> 15h": "#ef4444",
};

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

interface PeriodComparison {
  periodId: string;
  periodLabel: string;
  year: number;
  periodNumber: number;
  totalDrivers: number;
  totalOvertimePay: number;
  totalPositiveEnd: number;
  driversPositive: number;
  totalMissingEnd: number;
  driversNegative: number;
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const periodParam = searchParams.get("period") || "";
  const vehicleType = searchParams.get("vehicle");

  const [periodComparison, setPeriodComparison] = useState<PeriodComparison[]>([]);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    new Set(["Heures payées", "Heures positives fin", "Heures manquantes fin"])
  );
  const [distribution, setDistribution] = useState<{ bucket: string; count: number }[]>([]);
  const [monthlyAvg, setMonthlyAvg] = useState<{ name: string; moyenne: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Bucket drill-down state
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [bucketDrivers, setBucketDrivers] = useState<BucketDriver[]>([]);
  const [bucketSortAsc, setBucketSortAsc] = useState(true);
  const [bucketLoading, setBucketLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();

      // Parse period IDs (comma-separated) or fetch all
      let periodIds: string[] = [];
      if (periodParam) {
        periodIds = periodParam.split(",");
      } else {
        const { data } = await supabase
          .from("reference_periods")
          .select("id");
        periodIds = data?.map((p) => p.id) || [];
      }

      if (periodIds.length === 0) {
        setLoading(false);
        return;
      }

      const vt = vehicleType === "BUS" || vehicleType === "CAM" ? vehicleType : null;

      // 1. Counter distribution
      const { data: dist } = await supabase.rpc("get_counter_distribution", {
        p_period_ids: periodIds,
        p_vehicle_type: vt,
      });
      setDistribution(dist || []);

      // 2. Monthly average evolution
      let monthQuery = supabase
        .from("monthly_records")
        .select("month, year, counter_end, driver_id, drivers!inner(vehicle_type)")
        .in("period_id", periodIds)
        .order("year")
        .order("month");

      if (vt) {
        monthQuery = monthQuery.eq("drivers.vehicle_type", vt);
      }

      const { data: monthlyData } = await monthQuery;
      if (monthlyData) {
        const grouped = new Map<string, number[]>();
        monthlyData.forEach((r) => {
          const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(Number(r.counter_end));
        });

        const avgData = Array.from(grouped.entries())
          .sort()
          .map(([key, values]) => {
            const [year, month] = key.split("-").map(Number);
            return {
              name: `${FRENCH_MONTHS_SHORT[month]} ${year}`,
              moyenne: values.reduce((a, b) => a + b, 0) / values.length,
            };
          });
        setMonthlyAvg(avgData);
      }

      // 3. Status breakdown + Period comparison (same query, different aggregations)
      let summaryQuery = supabase
        .from("driver_period_summary")
        .select("period_id, period_label, year, period_number, latest_counter, buffer_hours, total_overtime_pay, vehicle_type")
        .in("period_id", periodIds);

      if (vt) {
        summaryQuery = summaryQuery.eq("vehicle_type", vt);
      }

      const { data: summaryData } = await summaryQuery;
      if (summaryData) {
        // Status breakdown
        const counts = { green: 0, orange: 0, red: 0 };
        summaryData.forEach((d) => {
          const status = getDriverStatus(
            Number(d.latest_counter),
            Number(d.buffer_hours),
            Number(d.total_overtime_pay) > 0
          );
          counts[status]++;
        });

        setStatusBreakdown(
          (Object.entries(counts) as [keyof typeof counts, number][])
            .filter(([, v]) => v > 0)
            .map(([key, value]) => ({
              name: STATUS_LABELS[key],
              value,
              fill: STATUS_COLORS[key],
            }))
        );

        // Period comparison aggregation
        const periodMap = new Map<string, PeriodComparison>();
        summaryData.forEach((d) => {
          const pid = d.period_id;
          if (!periodMap.has(pid)) {
            periodMap.set(pid, {
              periodId: pid,
              periodLabel: d.period_label,
              year: d.year,
              periodNumber: d.period_number,
              totalDrivers: 0,
              totalOvertimePay: 0,
              totalPositiveEnd: 0,
              driversPositive: 0,
              totalMissingEnd: 0,
              driversNegative: 0,
            });
          }
          const entry = periodMap.get(pid)!;
          entry.totalDrivers++;
          entry.totalOvertimePay += Number(d.total_overtime_pay);
          const counter = Number(d.latest_counter);
          if (counter > 0) {
            entry.totalPositiveEnd += counter;
            entry.driversPositive++;
          } else if (counter < 0) {
            entry.totalMissingEnd += Math.abs(counter);
            entry.driversNegative++;
          }
        });

        const sorted = Array.from(periodMap.values()).sort(
          (a, b) => a.year - b.year || a.periodNumber - b.periodNumber
        );
        setPeriodComparison(sorted);
      }

      setLoading(false);
    }
    fetchData();
    setSelectedBucket(null);
    setBucketDrivers([]);
  }, [periodParam, vehicleType]);

  const handleBucketClick = useCallback(
    async (bucket: string) => {
      if (selectedBucket === bucket) {
        setSelectedBucket(null);
        setBucketDrivers([]);
        return;
      }

      const range = BUCKET_RANGES[bucket];
      if (!range) return;

      setSelectedBucket(bucket);
      setBucketLoading(true);

      const supabase = createClient();

      let periodIds: string[] = [];
      if (periodParam) {
        periodIds = periodParam.split(",");
      } else {
        const { data } = await supabase.from("reference_periods").select("id");
        periodIds = data?.map((p) => p.id) || [];
      }

      const vt = vehicleType === "BUS" || vehicleType === "CAM" ? vehicleType : null;

      let query = supabase
        .from("driver_period_summary")
        .select("driver_id, code_salarie, vehicle_type, latest_counter")
        .in("period_id", periodIds);

      if (vt) query = query.eq("vehicle_type", vt);

      // Apply bucket range filter
      if (range.min !== -Infinity) query = query.gte("latest_counter", range.min);
      if (range.max !== Infinity) query = query.lt("latest_counter", range.max);

      const { data } = await query;

      // Deduplicate by driver (keep latest counter per driver across periods)
      const driverMap = new Map<string, BucketDriver>();
      (data || []).forEach((d) => {
        const existing = driverMap.get(d.driver_id);
        if (!existing) {
          driverMap.set(d.driver_id, {
            driverId: d.driver_id,
            codeSalarie: d.code_salarie,
            vehicleType: d.vehicle_type,
            latestCounter: Number(d.latest_counter),
          });
        }
      });

      setBucketDrivers(Array.from(driverMap.values()));
      setBucketSortAsc(true);
      setBucketLoading(false);
    },
    [selectedBucket, periodParam, vehicleType]
  );

  const sortedBucketDrivers = [...bucketDrivers].sort((a, b) =>
    bucketSortAsc ? a.latestCounter - b.latestCounter : b.latestCounter - a.latestCounter
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytique</h1>
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytique</h1>
        <p className="text-muted-foreground">
          Graphiques et tendances des heures excédentaires
        </p>
      </div>

      {/* Period comparison section */}
      {periodComparison.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Comparaison par période</CardTitle>
                <div className="flex gap-1.5">
                  {([
                    { key: "Heures payées", color: "#ef4444", label: "Payées" },
                    { key: "Heures positives fin", color: "#22c55e", label: "Positives" },
                    { key: "Heures manquantes fin", color: "#3b82f6", label: "Manquantes" },
                  ] as const).map(({ key, color, label }) => {
                    const active = visibleMetrics.has(key);
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className="text-xs h-7 px-2.5"
                        style={active ? { backgroundColor: color, borderColor: color } : { color, borderColor: color }}
                        onClick={() => {
                          setVisibleMetrics((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) {
                              if (next.size > 1) next.delete(key);
                            } else {
                              next.add(key);
                            }
                            return next;
                          });
                        }}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={periodComparison.map((p) => ({
                    name: p.periodLabel,
                    "Heures payées": Number(p.totalOvertimePay.toFixed(2)),
                    "Heures positives fin": Number(p.totalPositiveEnd.toFixed(2)),
                    "Heures manquantes fin": Number(p.totalMissingEnd.toFixed(2)),
                  }))}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(2)}h`]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                  {visibleMetrics.has("Heures payées") && (
                    <Bar dataKey="Heures payées" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleMetrics.has("Heures positives fin") && (
                    <Bar dataKey="Heures positives fin" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  )}
                  {visibleMetrics.has("Heures manquantes fin") && (
                    <Bar dataKey="Heures manquantes fin" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détail par période</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Conducteurs</TableHead>
                    <TableHead className="text-right">Heures payées</TableHead>
                    <TableHead className="text-right">H. positives fin</TableHead>
                    <TableHead className="text-right">H. manquantes fin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodComparison.map((p) => (
                    <TableRow key={p.periodId}>
                      <TableCell className="font-medium">{p.periodLabel}</TableCell>
                      <TableCell className="text-right">{p.totalDrivers}</TableCell>
                      <TableCell className="text-right font-mono">
                        {p.totalOvertimePay > 0 ? (
                          <span className="text-red-600 font-medium">
                            {p.totalOvertimePay.toFixed(2)}h
                          </span>
                        ) : (
                          "0,00h"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className="text-emerald-600">
                          {p.totalPositiveEnd.toFixed(2)}h
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({p.driversPositive})
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className="text-blue-600">
                          {p.totalMissingEnd.toFixed(2)}h
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({p.driversNegative})
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution des compteurs</CardTitle>
            <p className="text-xs text-muted-foreground">Cliquez sur une barre pour voir le détail</p>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bucket" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Conducteurs"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(data: any) => {
                      if (data?.bucket) handleBucketClick(data.bucket);
                    }}
                  >
                    {distribution.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={BUCKET_COLORS[entry.bucket] || "#6366f1"}
                        opacity={selectedBucket && selectedBucket !== entry.bucket ? 0.3 : 1}
                        stroke={selectedBucket === entry.bucket ? "#000" : "none"}
                        strokeWidth={selectedBucket === entry.bucket ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bucket drill-down detail */}
      {selectedBucket && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: BUCKET_COLORS[selectedBucket] || "#6366f1" }}
                />
                Conducteurs : {selectedBucket}
                <span className="text-muted-foreground font-normal text-sm">
                  ({bucketDrivers.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setBucketSortAsc((prev) => !prev)}
                >
                  {bucketSortAsc ? (
                    <><ArrowUp className="mr-1 h-3 w-3" /> Plus basses</>
                  ) : (
                    <><ArrowDown className="mr-1 h-3 w-3" /> Plus hautes</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setSelectedBucket(null); setBucketDrivers([]); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bucketLoading ? (
              <p className="py-4 text-center text-muted-foreground">Chargement...</p>
            ) : sortedBucketDrivers.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">Aucun conducteur</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code salarié</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => setBucketSortAsc((prev) => !prev)}
                        >
                          Compteur
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBucketDrivers.map((d) => (
                      <TableRow key={d.driverId}>
                        <TableCell>
                          <Link
                            href={`/drivers/${d.driverId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {d.codeSalarie}
                          </Link>
                        </TableCell>
                        <TableCell>{d.vehicleType}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          <span
                            className={
                              d.latestCounter > 10
                                ? "text-red-600"
                                : d.latestCounter < 0
                                ? "text-blue-600"
                                : "text-emerald-600"
                            }
                          >
                            {d.latestCounter.toFixed(2)}h
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly evolution */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution moyenne mensuelle des compteurs</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyAvg.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={monthlyAvg} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}h`, "Moyenne compteur"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="moyenne"
                  name="Moyenne compteur"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
