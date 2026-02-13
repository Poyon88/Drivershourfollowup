"use client";

import { Badge } from "@/components/ui/badge";
import { getDriverStatus, getStatusLabel, getStatusColor, type DriverStatus } from "@/lib/utils/status-helpers";

interface Props {
  counterEnd: number;
  bufferHours: number;
  hasOvertimePay: boolean;
}

export function DriverStatusBadge({ counterEnd, bufferHours, hasOvertimePay }: Props) {
  const status = getDriverStatus(counterEnd, bufferHours, hasOvertimePay);
  return (
    <Badge className={getStatusColor(status)} variant="secondary">
      {getStatusLabel(status)}
    </Badge>
  );
}
