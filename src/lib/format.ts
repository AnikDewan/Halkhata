/** Format whole rupees for display (en-IN, ₹ symbol, no paise). */
export function formatMoney(amountInRupees: number): string {
  const rupees = Math.round(amountInRupees);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Parse a user amount string into whole positive rupees, or null if invalid. */
export function parseRupees(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function formatDate(timestamp: number): string {
  // Formats date as 'DD MMM YYYY' in English-India locale
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
