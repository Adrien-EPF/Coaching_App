/** Sports offered when entering a cardio Session; any other sport can be typed. */
export const SPORT_SUGGESTIONS = ["Course", "Vélo", "Natation", "Tennis", "Boxe", "Volley", "Marche", "Football", "Escalade"];

/** The suggestions with the sports already used first (most used first), each sport once whatever its case. */
export function orderSports(used: string[]): string[] {
  const counts = new Map<string, { sport: string; n: number }>();
  for (const raw of used) {
    const sport = raw.trim();
    if (!sport) continue;
    const entry = counts.get(sport.toLowerCase()) ?? { sport, n: 0 };
    entry.n += 1;
    counts.set(sport.toLowerCase(), entry);
  }
  const first = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.sport);
  const seen = new Set(first.map((s) => s.toLowerCase()));
  return [...first, ...SPORT_SUGGESTIONS.filter((s) => !seen.has(s.toLowerCase()))];
}
