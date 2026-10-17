import React from "react";
import { View } from "react-native";
import { useQuery } from "../data/RepoContext";
import { SessionExercise } from "../data/repo";
import { addDays, todayIso } from "../domain/dates";
import { longDate, plural } from "../domain/format";
import { Card, Screen, Txt } from "../ui/kit";
import { space } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";

export function TodayScreen() {
  const today = todayIso();
  const plan = useQuery(async (repo) => {
    const days = await repo.getCalendar(today, addDays(today, 31), today);
    for (const day of days) {
      const item = day.items.find((i) => i.type === "planned" && i.status === "planned");
      if (item && item.type === "planned") {
        return { date: day.date, item, exercises: await repo.getSessionExercises(item.sessionId) };
      }
    }
    return null;
  }, [today]);
  const rest = useQuery(async (repo) => (await repo.getCalendar(today, today, today))[0].items.find((i) => i.type !== "planned"));

  return (
    <Screen title="Aujourd'hui" subtitle={longDate(today)}>
      {plan === undefined ? null : plan === null ? (
        <Card>
          <Txt kind="heading">Pas de séance prévue</Txt>
          <Txt muted>Crée un programme dans l'onglet Programme pour voir ta prochaine séance ici.</Txt>
        </Card>
      ) : (
        <>
          <Card>
            <Txt kind="caps" muted>{plan.date === today ? "Séance du jour" : `Prochaine séance · ${longDate(plan.date)}`}</Txt>
            <Txt kind="heading">{plan.item.name}</Txt>
            <Txt muted>
              {plural(plan.item.exerciseCount, "exercice", "exercices")} · {plural(plan.item.setCount, "série", "séries")}
            </Txt>
          </Card>
          <Txt kind="caps" muted>Plan de la séance</Txt>
          {plan.exercises.map((e) => (
            <ExerciseRow key={e.id} e={e} />
          ))}
        </>
      )}
      {rest && rest.type !== "unplanned" && (
        <Card>
          <Txt kind="strong">{rest.type === "rest" ? "Aujourd'hui : repos" : "Aujourd'hui : blessure"}</Txt>
          {rest.label ? <Txt muted>{rest.label}</Txt> : null}
        </Card>
      )}
    </Screen>
  );
}

function ExerciseRow({ e }: { e: SessionExercise }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Txt kind="heading" style={{ width: 24 }}>{e.position}</Txt>
        <View style={{ flex: 1 }}>
          <Txt kind="strong">{e.name}</Txt>
          <Txt kind="caption" muted>
            {plural(e.sets, "série", "séries")} · {GOAL_LABELS[e.goal]}
          </Txt>
        </View>
      </View>
    </Card>
  );
}
