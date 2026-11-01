import { describe, expect, it } from "vitest";
import { goalChanges, oneRmSeries, periodStart, weeklyActivity } from "../src/domain/progressSeries";

describe("periodStart", () => {
  it("goes back one, three or six months, and has no start for all", () => {
    expect(periodStart("1m", "2026-10-31")).toBe("2026-09-30");
    expect(periodStart("3m", "2026-10-31")).toBe("2026-07-31");
    expect(periodStart("6m", "2026-10-31")).toBe("2026-04-30");
    expect(periodStart("all", "2026-10-31")).toBeNull();
  });
});

describe("oneRmSeries", () => {
  const sets = [
    { date: "2026-10-12", weight: 100, reps: 5, goal: "strength" as const },
    { date: "2026-10-05", weight: 90, reps: 5, goal: "strength" as const },
    { date: "2026-10-05", weight: 100, reps: 1, goal: "strength" as const },
    { date: "2026-06-01", weight: 80, reps: 5, goal: "strength" as const },
  ];

  it("gives one Epley 1RM per Session (its best Set), sorted by date", () => {
    const points = oneRmSeries(sets, "all", "2026-10-31");
    expect(points.map((p) => p.date)).toEqual(["2026-06-01", "2026-10-05", "2026-10-12"]);
    expect(points[1].value).toBeCloseTo(105); // 90 x 5 beats 100 x 1
    expect(points[2].value).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it("keeps only the Sessions inside the period", () => {
    expect(oneRmSeries(sets, "1m", "2026-10-31").map((p) => p.date)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(oneRmSeries(sets, "3m", "2026-10-31")).toHaveLength(2);
    expect(oneRmSeries(sets, "6m", "2026-10-31")).toHaveLength(3);
  });

  it("is empty without any Set", () => {
    expect(oneRmSeries([], "all", "2026-10-31")).toEqual([]);
  });
});

describe("goalChanges", () => {
  it("marks the date where the Training Goal differs from the previous point", () => {
    const pts = [
      { date: "2026-09-01", value: 100, goal: "strength" as const },
      { date: "2026-09-08", value: 102, goal: "strength" as const },
      { date: "2026-09-15", value: 90, goal: "hypertrophy" as const },
      { date: "2026-09-22", value: 104, goal: "strength" as const },
    ];
    expect(goalChanges(pts)).toEqual([
      { date: "2026-09-15", from: "strength", to: "hypertrophy" },
      { date: "2026-09-22", from: "hypertrophy", to: "strength" },
    ]);
  });

  it("has no change with a single goal or no point", () => {
    expect(goalChanges([])).toEqual([]);
    expect(goalChanges([{ date: "2026-09-01", value: 100, goal: "strength" }])).toEqual([]);
  });
});

describe("weeklyActivity", () => {
  const TODAY = "2026-10-21"; // a Wednesday; its week starts Monday 2026-10-19

  it("sums volume and counts Sessions per type, Monday to Sunday", () => {
    const weeks = weeklyActivity(
      [
        { date: "2026-10-12", type: "strength", volume: 3000, durationMin: null },
        { date: "2026-10-14", type: "strength", volume: 2000, durationMin: null },
        { date: "2026-10-18", type: "cardio", volume: 0, durationMin: 45 },
        { date: "2026-10-19", type: "cardio", volume: 0, durationMin: 30 },
      ],
      "all",
      TODAY,
    );
    expect(weeks).toEqual([
      { weekStart: "2026-10-12", volume: 5000, strength: 2, cardio: 1, cardioMin: 45 },
      { weekStart: "2026-10-19", volume: 0, strength: 0, cardio: 1, cardioMin: 30 },
    ]);
  });

  it("keeps empty weeks between the first Session and today", () => {
    const weeks = weeklyActivity([{ date: "2026-10-05", type: "strength", volume: 1000, durationMin: null }], "all", TODAY);
    expect(weeks.map((w) => [w.weekStart, w.strength])).toEqual([
      ["2026-10-05", 1],
      ["2026-10-12", 0],
      ["2026-10-19", 0],
    ]);
  });

  it("puts a Sunday and the Monday after in different weeks", () => {
    const weeks = weeklyActivity(
      [
        { date: "2026-10-11", type: "strength", volume: 10, durationMin: null },
        { date: "2026-10-12", type: "strength", volume: 20, durationMin: null },
      ],
      "all",
      TODAY,
    );
    expect(weeks.slice(0, 2).map((w) => [w.weekStart, w.volume])).toEqual([
      ["2026-10-05", 10],
      ["2026-10-12", 20],
    ]);
  });

  it("starts at the period, with empty weeks even when nothing was done", () => {
    const weeks = weeklyActivity([{ date: "2026-01-05", type: "strength", volume: 1000, durationMin: null }], "1m", TODAY);
    expect(weeks[0].weekStart).toBe("2026-09-21"); // Monday of 2026-09-21
    expect(weeks.at(-1)?.weekStart).toBe("2026-10-19");
    expect(weeks.every((w) => w.strength === 0 && w.volume === 0)).toBe(true);
  });

  it("is empty with no Session over all time", () => {
    expect(weeklyActivity([], "all", TODAY)).toEqual([]);
  });
});
