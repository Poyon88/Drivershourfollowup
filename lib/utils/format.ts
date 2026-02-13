export function formatHours(value: number): string {
  return value.toFixed(2).replace(".", ",") + "h";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + "h";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}
