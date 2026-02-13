import { STATUS_THRESHOLD_ORANGE } from "@/lib/constants";

export type DriverStatus = "green" | "orange" | "red";

export function getDriverStatus(
  counterEnd: number,
  bufferHours: number,
  hasOvertimePay: boolean
): DriverStatus {
  if (hasOvertimePay) return "red";
  if (bufferHours > 0 && counterEnd > bufferHours * STATUS_THRESHOLD_ORANGE) return "orange";
  return "green";
}

export function getStatusLabel(status: DriverStatus): string {
  switch (status) {
    case "green":
      return "Normal";
    case "orange":
      return "Attention";
    case "red":
      return "Critique";
  }
}

export function getStatusColor(status: DriverStatus): string {
  switch (status) {
    case "green":
      return "bg-emerald-100 text-emerald-800";
    case "orange":
      return "bg-amber-100 text-amber-800";
    case "red":
      return "bg-red-100 text-red-800";
  }
}
