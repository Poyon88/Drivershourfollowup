"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIODS, VEHICLE_TYPES } from "@/lib/constants";

interface ReferencePeriod {
  id: string;
  year: number;
  period_number: number;
  label: string;
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [periods, setPeriods] = useState<ReferencePeriod[]>([]);

  const periodId = searchParams.get("period") || "";
  const vehicleType = searchParams.get("vehicle") || "all";

  useEffect(() => {
    async function fetchPeriods() {
      const supabase = createClient();
      const { data } = await supabase
        .from("reference_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("period_number", { ascending: false });
      if (data) setPeriods(data);
    }
    fetchPeriods();
  }, []);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />
      <div className="flex items-center gap-3">
        <Select
          value={periodId}
          onValueChange={(val) => updateFilter("period", val)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Période de référence" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={vehicleType}
          onValueChange={(val) => updateFilter("vehicle", val)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {VEHICLE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type === "BUS" ? "Bus" : "Van (CAM)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
