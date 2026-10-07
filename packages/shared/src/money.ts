/** Formats an amount as `RWF 1,250` (no decimals — RWF has no minor unit in practice). */
export function formatRwf(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}RWF ${digits}`;
}

/** Formats a distance as `4.2 km`. */
export function formatKm(km: number): string {
  return `${(Math.round(km * 10) / 10).toFixed(1)} km`;
}
