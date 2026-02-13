"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DriverStatusBadge } from "@/components/drivers/driver-status-badge";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface DriverSummary {
  driver_id: string;
  code_salarie: string;
  vehicle_type: string;
  total_positive_hours: number;
  total_missing_hours: number;
  total_overtime_pay: number;
  latest_counter: number;
  buffer_hours: number;
  months_recorded: number;
}

type SortKey = "code_salarie" | "vehicle_type" | "latest_counter" | "total_overtime_pay";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export function DriverListClient({ drivers }: { drivers: DriverSummary[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code_salarie");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = drivers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.code_salarie.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === "string"
        ? (aVal as string).localeCompare(bVal as string)
        : (Number(aVal) - Number(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [drivers, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 h-3 w-3" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3 w-3" />
      : <ChevronDown className="ml-1 h-3 w-3" />;
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un code salarié..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("code_salarie")}>
                  Code salarié <SortIcon column="code_salarie" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center font-medium" onClick={() => toggleSort("vehicle_type")}>
                  Type <SortIcon column="vehicle_type" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="ml-auto flex items-center font-medium" onClick={() => toggleSort("latest_counter")}>
                  Compteur <SortIcon column="latest_counter" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button className="ml-auto flex items-center font-medium" onClick={() => toggleSort("total_overtime_pay")}>
                  Heures sup. <SortIcon column="total_overtime_pay" />
                </button>
              </TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun conducteur trouvé
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((d) => (
                <TableRow key={d.driver_id}>
                  <TableCell>
                    <Link
                      href={`/drivers/${d.driver_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {d.code_salarie}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.vehicle_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(d.latest_counter).toFixed(2)}h
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(d.total_overtime_pay) > 0 ? (
                      <span className="text-red-600">
                        {Number(d.total_overtime_pay).toFixed(2)}h
                      </span>
                    ) : (
                      "0,00h"
                    )}
                  </TableCell>
                  <TableCell>
                    <DriverStatusBadge
                      counterEnd={Number(d.latest_counter)}
                      bufferHours={Number(d.buffer_hours)}
                      hasOvertimePay={Number(d.total_overtime_pay) > 0}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} conducteur(s) — Page {page + 1}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
