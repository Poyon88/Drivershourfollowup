"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Bus, AlertTriangle, Clock } from "lucide-react";

interface DashboardStats {
  total_drivers: number;
  bus_count: number;
  cam_count: number;
  drivers_with_overtime: number;
  total_overtime_pay: number;
  critical_count: number;
  negative_count: number;
}

export function KpiCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      title: "Total conducteurs",
      value: stats.total_drivers,
      description: `${stats.bus_count} Bus / ${stats.cam_count} Van`,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      title: "Répartition Bus / Van",
      value: stats.bus_count > 0
        ? `${Math.round((stats.bus_count / stats.total_drivers) * 100)}%`
        : "0%",
      description: `Bus: ${stats.bus_count} — Van: ${stats.cam_count}`,
      icon: Bus,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
    },
    {
      title: "Alertes critiques",
      value: stats.critical_count,
      description: `${stats.drivers_with_overtime} avec heures sup.`,
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      title: "Heures sup. à payer",
      value: `${Number(stats.total_overtime_pay).toFixed(1)}h`,
      description: `${stats.drivers_with_overtime} conducteur(s) concerné(s)`,
      icon: Clock,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.description}
                </p>
              </div>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
