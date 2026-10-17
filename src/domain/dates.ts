/** Calendar dates are plain "YYYY-MM-DD" strings, computed in UTC so time zones never shift a day. */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export function toDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

/** Monday = 0 ... Sunday = 6. */
export function weekday(iso: IsoDate): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -weekday(iso));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayIso(now: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
