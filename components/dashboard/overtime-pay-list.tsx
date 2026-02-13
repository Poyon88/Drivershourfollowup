"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface OvertimeDriver {
  driver_id: string;
  code_salarie: string;
  vehicle_type: string;
  total_overtime_pay: number;
  latest_counter: number;
}

export function OvertimePayList({ drivers }: { drivers: OvertimeDriver[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heures supplémentaires à payer</CardTitle>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">
            Aucune heure supplémentaire à payer
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code salarié</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Heures sup.</TableHead>
                <TableHead className="text-right">Compteur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
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
                  <TableCell className="text-right font-medium text-red-600">
                    {Number(d.total_overtime_pay).toFixed(2)}h
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(d.latest_counter).toFixed(2)}h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
