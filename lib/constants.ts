export const FRENCH_MONTHS: Record<number, string> = {
  1: "Janvier",
  2: "Février",
  3: "Mars",
  4: "Avril",
  5: "Mai",
  6: "Juin",
  7: "Juillet",
  8: "Août",
  9: "Septembre",
  10: "Octobre",
  11: "Novembre",
  12: "Décembre",
};

export const FRENCH_MONTHS_SHORT: Record<number, string> = {
  1: "Janv",
  2: "Fév",
  3: "Mars",
  4: "Avr",
  5: "Mai",
  6: "Juin",
  7: "Juil",
  8: "Août",
  9: "Sept",
  10: "Oct",
  11: "Nov",
  12: "Déc",
};

export const PERIODS = [
  { number: 1, label: "P1", months: [1, 2, 3, 4], startMonth: 1, endMonth: 4 },
  { number: 2, label: "P2", months: [5, 6, 7, 8], startMonth: 5, endMonth: 8 },
  { number: 3, label: "P3", months: [9, 10, 11, 12], startMonth: 9, endMonth: 12 },
] as const;

export const VEHICLE_TYPES = ["BUS", "CAM"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export function getPeriodLabel(periodNumber: number, year: number): string {
  const period = PERIODS.find((p) => p.number === periodNumber);
  if (!period) return "";
  const startMonth = FRENCH_MONTHS_SHORT[period.startMonth];
  const endMonth = FRENCH_MONTHS_SHORT[period.endMonth];
  return `P${periodNumber} ${year} (${startMonth}-${endMonth})`;
}

export function getCurrentPeriod(): { periodNumber: number; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const periodNumber = month <= 4 ? 1 : month <= 8 ? 2 : 3;
  return { periodNumber, year };
}

// Status thresholds
export const STATUS_THRESHOLD_ORANGE = 0.8; // 80% of buffer
