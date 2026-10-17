import type { IsoDate } from "./dates";

/** One-rep-max formulas, from the weight lifted and the reps done. Never fed bodyweight. */
const FORMULAS = {
  epley: (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30)),
} as const;

/** The formula behind the Estimated 1RM: a config value, swap the key to change it. */
export const ONE_RM_FORMULA: keyof typeof FORMULAS = "epley";

export const estimateOneRepMax = (weight: number, reps: number): number => FORMULAS[ONE_RM_FORMULA](weight, reps);

export interface LiftedSet {
  weight: number;
  reps: number;
  date: IsoDate;
}

export interface PersonalRecord {
  reps: number;
  weight: number;
  /** The first day this weight was lifted for these reps. */
  date: IsoDate;
}

/** The heaviest weight at each rep count, by rep count ascending. */
export function personalRecords(sets: LiftedSet[]): PersonalRecord[] {
  const best = new Map<number, PersonalRecord>();
  for (const s of sets) {
    const current = best.get(s.reps);
    if (!current || s.weight > current.weight || (s.weight === current.weight && s.date < current.date)) {
      best.set(s.reps, { reps: s.reps, weight: s.weight, date: s.date });
    }
  }
  return [...best.values()].sort((a, b) => a.reps - b.reps);
}
