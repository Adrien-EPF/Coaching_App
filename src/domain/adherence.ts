import type { IsoDate } from "./dates";

export interface PlannedDay {
  date: IsoDate;
  status: "planned" | "done" | "skipped" | "missed" | "moved";
}

export interface AdherenceBucket {
  /** "YYYY-MM" or "YYYY". */
  period: string;
  planned: number;
  done: number;
}

/**
 * Sessions done versus planned, per month and per year, in date order.
 * A moved Session counts where it lands (not at its origin), and one not yet due is left out.
 */
export function adherence(days: PlannedDay[]): { months: AdherenceBucket[]; years: AdherenceBucket[] } {
  const months = new Map<string, AdherenceBucket>();
  for (const d of [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (d.status === "moved" || d.status === "planned") continue;
    const period = d.date.slice(0, 7);
    const bucket = months.get(period) ?? { period, planned: 0, done: 0 };
    bucket.planned += 1;
    if (d.status === "done") bucket.done += 1;
    months.set(period, bucket);
  }
  const years = new Map<string, AdherenceBucket>();
  for (const m of months.values()) {
    const period = m.period.slice(0, 4);
    const bucket = years.get(period) ?? { period, planned: 0, done: 0 };
    bucket.planned += m.planned;
    bucket.done += m.done;
    years.set(period, bucket);
  }
  return { months: [...months.values()], years: [...years.values()] };
}
