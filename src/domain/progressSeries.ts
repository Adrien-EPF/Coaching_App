import { IsoDate, addDays, mondayOf } from "./dates";
import { estimateOneRepMax } from "./records";

export type Period = "1m" | "3m" | "6m" | "all";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "1m", label: "1 mois" },
  { key: "3m", label: "3 mois" },
  { key: "6m", label: "6 mois" },
  { key: "all", label: "Tout" },
];

export const DEFAULT_PERIOD: Period = "3m";

const MONTHS_BACK: Record<Exclude<Period, "all">, number> = { "1m": 1, "3m": 3, "6m": 6 };

/** The first day inside the period, or null for all time. A month back lands on the same day, or the month's last day. */
export function periodStart(period: Period, today: IsoDate): IsoDate | null {
  if (period === "all") return null;
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - MONTHS_BACK[period], 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

export type Goal = "strength" | "endurance" | "hypertrophy";

export interface OneRmPoint {
  date: IsoDate;
  value: number;
  goal: Goal;
}

/** The Estimated 1RM of each Session of an Exercise (its best Set), by date, inside the period. */
export function oneRmSeries(sets: { date: IsoDate; weight: number; reps: number; goal: Goal }[], period: Period, today: IsoDate): OneRmPoint[] {
  const start = periodStart(period, today);
  const byDate = new Map<IsoDate, OneRmPoint>();
  for (const s of sets) {
    if (start && s.date < start) continue;
    const value = estimateOneRepMax(s.weight, s.reps);
    const best = byDate.get(s.date);
    if (!best || value > best.value) byDate.set(s.date, { date: s.date, value, goal: s.goal });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface GoalChange {
  date: IsoDate;
  from: Goal;
  to: Goal;
}

/** Where the Training Goal switches from one point to the next. */
export function goalChanges(points: OneRmPoint[]): GoalChange[] {
  const changes: GoalChange[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].goal !== points[i - 1].goal) changes.push({ date: points[i].date, from: points[i - 1].goal, to: points[i].goal });
  }
  return changes;
}

export interface ActivitySession {
  date: IsoDate;
  type: "strength" | "cardio";
  /** Sets x reps x load, for a strength Session. */
  volume: number;
  /** Only cardio has a duration: strength Sessions are not timed. */
  durationMin: number | null;
}

export interface WeekActivity {
  /** The Monday. */
  weekStart: IsoDate;
  volume: number;
  strength: number;
  cardio: number;
  cardioMin: number;
}

/** Sessions per week (Monday to Sunday) from the period start, or the first Session, to this week. Empty weeks are kept. */
export function weeklyActivity(sessions: ActivitySession[], period: Period, today: IsoDate): WeekActivity[] {
  const start = periodStart(period, today);
  const inside = sessions.filter((s) => s.date <= today && (!start || s.date >= start));
  const first = start ?? inside.map((s) => s.date).sort()[0];
  if (!first) return [];
  const weeks = new Map<IsoDate, WeekActivity>();
  for (let w = mondayOf(first); w <= today; w = addDays(w, 7)) weeks.set(w, { weekStart: w, volume: 0, strength: 0, cardio: 0, cardioMin: 0 });
  for (const s of inside) {
    const week = weeks.get(mondayOf(s.date));
    if (!week) continue;
    if (s.type === "cardio") {
      week.cardio += 1;
      week.cardioMin += s.durationMin ?? 0;
    } else {
      week.strength += 1;
      week.volume += s.volume;
    }
  }
  return [...weeks.values()];
}
