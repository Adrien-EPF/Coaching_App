import { IsoDate, toDate, weekday } from "./dates";

export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** "Samedi 17 octobre" */
export function longDate(iso: IsoDate): string {
  const d = toDate(iso);
  return `${DAYS[weekday(iso)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "17 octobre" */
export function shortDate(iso: IsoDate): string {
  const d = toDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = toDate(text);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
