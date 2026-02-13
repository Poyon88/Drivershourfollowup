"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [distribution, setDistribution] = useState<{ bucket: string; count: number }[]>([]);
  const [monthlyAvg, setMonthlyAvg] = useState<{ name: string; moyenne: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [periodParam, vehicleType]);

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
              <CardTitle>Comparaison par période</CardTitle>
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
                  <Bar dataKey="Heures payées" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Heures positives fin" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Heures manquantes fin" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                  <Bar dataKey="count" name="Conducteurs" radius={[4, 4, 0, 0]}>
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={BUCKET_COLORS[entry.bucket] || "#6366f1"} />
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
