"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VEHICLE_TYPES } from "@/lib/constants";
import { ChevronDown } from "lucide-react";

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
  const [open, setOpen] = useState(false);

  // Parse comma-separated period IDs from URL
  const periodParam = searchParams.get("period") || "";
  const selectedPeriodIds = periodParam ? periodParam.split(",") : [];

  const vehicleType = searchParams.get("vehicle") || "all";

  const hasCleaned = useRef(false);
  useEffect(() => {
    async function fetchPeriods() {
      const supabase = createClient();
      const { data } = await supabase
        .from("reference_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("period_number", { ascending: false });
      if (data) {
        setPeriods(data);
        // Clean up stale period IDs from URL
        if (!hasCleaned.current && selectedPeriodIds.length > 0) {
          hasCleaned.current = true;
          const validIds = new Set(data.map((p) => p.id));
          const cleaned = selectedPeriodIds.filter((id) => validIds.has(id));
          if (cleaned.length !== selectedPeriodIds.length) {
            const params = new URLSearchParams(searchParams.toString());
            if (cleaned.length === 0 || cleaned.length === data.length) {
              params.delete("period");
            } else {
              params.set("period", cleaned.join(","));
            }
            router.replace(`${pathname}?${params.toString()}`);
          }
        }
      }
    }
    fetchPeriods();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const togglePeriod = useCallback(
    (id: string) => {
      let next: string[];
      if (selectedPeriodIds.includes(id)) {
        next = selectedPeriodIds.filter((p) => p !== id);
      } else {
        next = [...selectedPeriodIds, id];
      }
      // If all selected or none selected, clear the param (= all)
      if (next.length === 0 || next.length === periods.length) {
        updateParams("period", "");
      } else {
        updateParams("period", next.join(","));
      }
    },
    [selectedPeriodIds, periods, updateParams]
  );

  const selectAll = useCallback(() => {
    updateParams("period", "");
  }, [updateParams]);

  const allSelected = selectedPeriodIds.length === 0;

  // Display label for the trigger
  let triggerLabel = "Toutes les périodes";
  if (!allSelected) {
    if (selectedPeriodIds.length === 1) {
      const p = periods.find((p) => p.id === selectedPeriodIds[0]);
      triggerLabel = p?.label || "1 période";
    } else {
      triggerLabel = `${selectedPeriodIds.length} périodes`;
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />
      <div className="flex items-center gap-3">
        {/* Period multi-select */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[260px] justify-between font-normal"
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-2" align="end">
            {/* Select all */}
            <label className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => selectAll()}
              />
              <span className="font-medium">Toutes les périodes</span>
            </label>
            <div className="my-1 border-t" />
            {/* Individual periods */}
            {periods.map((p) => {
              const isChecked = allSelected || selectedPeriodIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => togglePeriod(p.id)}
                  />
                  {p.label}
                </label>
              );
            })}
          </PopoverContent>
        </Popover>

        <Select
          value={vehicleType}
          onValueChange={(val) => updateParams("vehicle", val === "all" ? "" : val)}
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
