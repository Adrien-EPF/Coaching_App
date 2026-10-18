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

/** "2026-10-17" -> "17/10/2026" */
export function formatFr(iso: IsoDate): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "17/10/2026" -> "2026-10-17"; null when the text is not a real date. */
export function parseFr(text: string): IsoDate | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** Types digits and the slashes come by themselves: "17102026" -> "17/10/2026". */
export function maskFr(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
