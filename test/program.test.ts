import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { CycleKind } from "../src/domain/cycle";
import { memoryDb } from "./nodeDb";

// 2026-10-05 is a Monday.
const START = "2026-10-05";
let repo: Repo;

beforeEach(async () => {
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
});

async function programWith(cycle: CycleKind, slots: number[]) {
  const programId = await repo.createProgram({ name: "Force 2026", cycle, startDate: START });
  const ids: number[] = [];
  for (const slot of slots) ids.push(await repo.addSession(programId, { name: `S${slot}`, slot }));
  return { programId, ids };
}

async function plannedDates(from: string, to: string, today = "2026-10-01") {
  const days = await repo.getCalendar(from, to, today);
  return days.filter((d) => d.items.some((i) => i.type === "planned")).map((d) => d.date);
}

describe("migration", () => {
  it("is idempotent", async () => {
    const db = memoryDb();
    await migrate(db);
    await migrate(db);
    expect(await new Repo(db).getActiveProgram()).toBeUndefined();
  });
});

describe("Program and Cycle", () => {
  it("1 week: Sessions repeat every week on their weekday", async () => {
    await programWith("week", [0, 2, 5]); // Mon, Wed, Sat
    expect(await plannedDates("2026-10-05", "2026-10-18")).toEqual([
      "2026-10-05", "2026-10-07", "2026-10-10", "2026-10-12", "2026-10-14", "2026-10-17",
    ]);
  });

  it("2 weeks: Sessions repeat every 14 days", async () => {
    await programWith("twoWeeks", [0, 9]); // Mon of week 1, Wed of week 2
    expect(await plannedDates("2026-10-05", "2026-11-08")).toEqual([
      "2026-10-05", "2026-10-14", "2026-10-19", "2026-10-28", "2026-11-02",
    ]);
  });

  it("1 month: Sessions fall on a day of the month, clamped to short months", async () => {
    await programWith("month", [3, 31]);
    expect(await plannedDates("2026-10-05", "2027-02-28")).toEqual([
      "2026-10-31", "2026-11-03", "2026-11-30", "2026-12-03", "2026-12-31", "2027-01-03", "2027-01-31", "2027-02-03", "2027-02-28",
    ]);
  });

  it("nothing is planned before the Program starts", async () => {
    await programWith("week", [0, 2]);
    expect(await plannedDates("2026-09-28", "2026-10-06")).toEqual(["2026-10-05"]);
  });

  it("rejects a slot outside the Cycle", async () => {
    const programId = await repo.createProgram({ name: "P", cycle: "week", startDate: START });
    await expect(repo.addSession(programId, { name: "X", slot: 7 })).rejects.toThrow();
  });

  it("a new Program becomes the active one", async () => {
    await programWith("week", [0]);
    const second = await repo.createProgram({ name: "Autre", cycle: "month", startDate: START });
    expect((await repo.getActiveProgram())?.id).toBe(second);
  });
});

describe("Exercises", () => {
  it("keep a stable identity across renames", async () => {
    const { ids } = await programWith("week", [0]);
    const se = await repo.addExercise(ids[0], { name: "Traction lestée", sets: 4, goal: "strength" });
    const before = (await repo.getSessionExercises(ids[0]))[0];
    await repo.renameExercise(before.exerciseId, "Traction lestée (pronation)");
    const after = (await repo.getSessionExercises(ids[0]))[0];
    expect(after.id).toBe(se);
    expect(after.exerciseId).toBe(before.exerciseId);
    expect(after.name).toBe("Traction lestée (pronation)");
  });

  it("reuses the same Exercise when added to a second Session", async () => {
    const { ids } = await programWith("week", [0, 3]);
    await repo.addExercise(ids[0], { name: "Squat", sets: 5, goal: "strength" });
    const exerciseId = (await repo.getSessionExercises(ids[0]))[0].exerciseId;
    await repo.addExercise(ids[1], { exerciseId, sets: 3, goal: "endurance" });
    const other = (await repo.getSessionExercises(ids[1]))[0];
    expect(other.exerciseId).toBe(exerciseId);
    expect(other.goal).toBe("endurance");
  });

  it("keeps order and rejects non-positive Sets", async () => {
    const { ids } = await programWith("week", [0]);
    await repo.addExercise(ids[0], { name: "A", sets: 3, goal: "strength" });
    await repo.addExercise(ids[0], { name: "B", sets: 4, goal: "hypertrophy" });
    expect((await repo.getSessionExercises(ids[0])).map((e) => e.name)).toEqual(["A", "B"]);
    await expect(repo.addExercise(ids[0], { name: "C", sets: 0, goal: "strength" })).rejects.toThrow();
  });

  it("describes the whole Program", async () => {
    const { programId, ids } = await programWith("week", [0]);
    await repo.addExercise(ids[0], { name: "Squat", sets: 5, goal: "strength" });
    const detail = await repo.getProgramDetail(programId);
    expect(detail.sessions[0].exercises.map((e) => [e.name, e.sets])).toEqual([["Squat", 5]]);
  });
});

describe("Calendar actions", () => {
  it("skips a Session on one date only", async () => {
    const { ids } = await programWith("week", [0]);
    await repo.skipSession(ids[0], "2026-10-12");
    const days = await repo.getCalendar("2026-10-05", "2026-10-19", "2026-10-01");
    const status = (d: string) => days.find((x) => x.date === d)!.items[0];
    expect(status("2026-10-05")).toMatchObject({ type: "planned", status: "planned" });
    expect(status("2026-10-12")).toMatchObject({ type: "planned", status: "skipped" });
    expect(status("2026-10-19")).toMatchObject({ type: "planned", status: "planned" });
  });

  it("moves a Session to another day, leaving a trace and not touching the Program", async () => {
    const { ids } = await programWith("week", [0]);
    await repo.moveSession(ids[0], "2026-10-12", "2026-10-14");
    const days = await repo.getCalendar("2026-10-12", "2026-10-19", "2026-10-01");
    const get = (d: string) => days.find((x) => x.date === d)!.items;
    expect(get("2026-10-12")[0]).toMatchObject({ status: "moved", movedTo: "2026-10-14" });
    expect(get("2026-10-14")[0]).toMatchObject({ type: "planned", status: "planned", movedFrom: "2026-10-12" });
    expect(get("2026-10-19")[0]).toMatchObject({ status: "planned" });
  });

  it("refuses to move a Session onto its own day", async () => {
    const { ids } = await programWith("week", [0]);
    await expect(repo.moveSession(ids[0], "2026-10-12", "2026-10-12")).rejects.toThrow();
  });

  it("an undone action restores the planned Session", async () => {
    const { ids } = await programWith("week", [0]);
    await repo.skipSession(ids[0], "2026-10-12");
    await repo.clearOccurrence(ids[0], "2026-10-12");
    const days = await repo.getCalendar("2026-10-12", "2026-10-12", "2026-10-01");
    expect(days[0].items[0]).toMatchObject({ status: "planned" });
  });

  it("a past planned Session nobody did is Missed, and the Program does not shift", async () => {
    await programWith("week", [0]);
    const days = await repo.getCalendar("2026-10-05", "2026-10-26", "2026-10-14");
    const statuses = days
      .filter((d) => d.items.length)
      .map((d) => [d.date, (d.items[0] as { status: string }).status]);
    expect(statuses).toEqual([
      ["2026-10-05", "missed"],
      ["2026-10-12", "missed"],
      ["2026-10-19", "planned"],
      ["2026-10-26", "planned"],
    ]);
  });

  it("marks a Session Missed explicitly, only for that date", async () => {
    const { ids } = await programWith("week", [0]);
    await repo.markMissed(ids[0], "2026-10-12");
    const days = await repo.getCalendar("2026-10-12", "2026-10-19", "2026-10-12");
    expect(days[0].items[0]).toMatchObject({ status: "missed" });
    expect(days[7].items[0]).toMatchObject({ status: "planned" });
  });

  it("adds an Unplanned Session on any day", async () => {
    await programWith("week", [0]);
    await repo.addUnplanned("2026-10-08", "Pompes à la maison");
    const days = await repo.getCalendar("2026-10-08", "2026-10-08", "2026-10-01");
    expect(days[0].items).toMatchObject([{ type: "unplanned", label: "Pompes à la maison" }]);
  });

  it("marks rest days and injuries, which skip the planned Session of that day", async () => {
    await programWith("week", [0, 2]);
    await repo.markRest("2026-10-05");
    await repo.markInjury("2026-10-07", "Épaule");
    const days = await repo.getCalendar("2026-10-05", "2026-10-07", "2026-10-01");
    expect(days[0].items.map((i) => i.type)).toEqual(["planned", "rest"]);
    expect(days[0].items[0]).toMatchObject({ status: "skipped" });
    expect(days[2].items).toMatchObject([
      { type: "planned", status: "skipped" },
      { type: "injury", label: "Épaule" },
    ]);
  });

  it("removes a rest/injury/unplanned entry", async () => {
    await programWith("week", [0]);
    const id = await repo.markRest("2026-10-05");
    await repo.removeEntry(id);
    const days = await repo.getCalendar("2026-10-05", "2026-10-05", "2026-10-01");
    expect(days[0].items).toMatchObject([{ type: "planned", status: "planned" }]);
  });

  it("shows nothing planned when there is no Program", async () => {
    const days = await repo.getCalendar("2026-10-05", "2026-10-06", "2026-10-01");
    expect(days.every((d) => d.items.length === 0)).toBe(true);
  });
});
