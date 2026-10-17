import { addDays, daysInMonth, diffDays, IsoDate, mondayOf, toDate, toIso } from "./dates";

/** The repeating span of a Program. */
export type CycleKind = "week" | "twoWeeks" | "month";

export const CYCLE_LABELS: Record<CycleKind, string> = {
  week: "1 semaine",
  twoWeeks: "2 semaines",
  month: "1 mois",
};

/**
 * Where a Session sits inside a Cycle (its "slot"):
 * - week: 0..6, Monday to Sunday
 * - twoWeeks: 0..13, counted from the Monday of the first week
 * - month: 1..31, the day of the month (clamped to the month's last day)
 */
export function slotCount(kind: CycleKind): number {
  return kind === "week" ? 7 : kind === "twoWeeks" ? 14 : 31;
}

export function isValidSlot(kind: CycleKind, slot: number): boolean {
  if (!Number.isInteger(slot)) return false;
  return kind === "month" ? slot >= 1 && slot <= 31 : slot >= 0 && slot < slotCount(kind);
}

/** Dates on which a Session placed at `slot` falls, between `from` and `to` (inclusive). */
export function datesForSlot(kind: CycleKind, startDate: IsoDate, slot: number, from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  if (kind === "month") {
    const first = toDate(from);
    let year = first.getUTCFullYear();
    let month = first.getUTCMonth() + 1;
    for (;;) {
      const day = Math.min(slot, daysInMonth(year, month));
      const date = toIso(new Date(Date.UTC(year, month - 1, day)));
      if (date > to) break;
      if (date >= from && date >= startDate) out.push(date);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return out;
  }
  const length = kind === "week" ? 7 : 14;
  const anchor = mondayOf(startDate);
  const begin = from > startDate ? from : startDate;
  // First date >= begin whose offset from the anchor is congruent to the slot.
  const offset = diffDays(begin, anchor);
  const wait = (((slot - offset) % length) + length) % length;
  for (let d = addDays(begin, wait); d <= to; d = addDays(d, length)) out.push(d);
  return out;
}

/** Short French label for a slot, e.g. "Lundi", "Semaine 2 · Jeudi", "Le 15". */
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export function slotLabel(kind: CycleKind, slot: number): string {
  if (kind === "month") return `Le ${slot}`;
  if (kind === "week") return DAYS[slot];
  return `Semaine ${Math.floor(slot / 7) + 1} · ${DAYS[slot % 7]}`;
}
