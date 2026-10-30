// Dates are stored as ISO day strings ("2026-10-28") and shown in en-GB format.

function atNoon(isoDate: string): Date {
  // Noon avoids the day shifting across time zones.
  return new Date(`${isoDate}T12:00:00`);
}

/** "Wed 28 Oct" for headers. */
export function formatShortDate(isoDate: string): string {
  return atNoon(isoDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "28 Oct 2026" for lists. */
export function formatLongDate(isoDate: string): string {
  return atNoon(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Today's date in the browser's time zone as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "15.11.2026" for due dates, matching the date input's display. */
export function formatDueDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
