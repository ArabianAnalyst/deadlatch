export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

/** A short age for the band. Clock skew in either direction reads as under a minute rather than a negative number. */
export function minutesAgo(iso: string, now: Date = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  if (m < 1) return "under a minute ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
