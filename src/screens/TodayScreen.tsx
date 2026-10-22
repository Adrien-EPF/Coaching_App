import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { SessionExercise, StoredPlan } from "../data/repo";
import { addDays, todayIso } from "../domain/dates";
import { longDate, plural } from "../domain/format";
import type { RootParams } from "../navigation";
import { TIMED } from "../rules/rules";
import { Button, Card, ErrorText, Screen, Txt } from "../ui/kit";
import { space } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";
import { ProblemSheet } from "./ProblemSheet";

export function TodayScreen() {
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const today = todayIso();
  const { repo } = useStore();
  const act = useAction();
  const [reporting, setReporting] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);
  const plan = useQuery(async (repo) => {
    const days = await repo.getCalendar(today, addDays(today, 31), today);
    for (const day of days) {
      const item = day.items.find((i) => i.type === "planned" && i.status === "planned");
      if (item && item.type === "planned") {
        return {
          date: day.date,
          item,
          exercises: await repo.getSessionExercises(item.sessionId),
          stored: await repo.getPlan(item.sessionId),
          reports: await repo.getProblemReports(item.sessionId, day.date),
        };
      }
    }
    return null;
  }, [today]);
  const rest = useQuery(async (repo) => (await repo.getCalendar(today, today, today))[0].items.find((i) => i.type !== "planned"));

  return (
    <Screen title="Aujourd'hui" subtitle={longDate(today)} right={<Button label="Réglages" kind="secondary" small onPress={() => navigation.navigate("Settings")} />}>
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
          {plan.date <= today ? (
            <Button label="Commencer la séance" onPress={() => navigation.navigate("Log", { programSessionId: plan.item.sessionId, date: plan.date })} />
          ) : null}
          <Button label="Signaler un problème" kind="secondary" onPress={() => setReporting(true)} />
          {plan.reports.map((r) => (
            <Card key={r.id}>
              <Txt kind="caps" muted>Problème signalé</Txt>
              <Txt>{[r.kinds.join(", "), r.details].filter(Boolean).join(" · ")}</Txt>
              <Button
                label={replanning ? "Replanification…" : "Annuler ce problème et replanifier"}
                kind="secondary"
                small
                disabled={replanning}
                onPress={async () => {
                  setReplanning(true);
                  setReplanError(null);
                  // The card goes away at once; planning again can take a few seconds with Gemini.
                  if (await act(() => repo.removeProblemReport(r.id), setReplanError)) {
                    await act(() => repo.replanSession(plan.item.sessionId, plan.date), setReplanError);
                  }
                  setReplanning(false);
                }}
              />
            </Card>
          ))}
          <Txt kind="caps" muted>Plan de la séance</Txt>
          {plan.stored?.note ? <Txt kind="caption" muted>{plan.stored.note}</Txt> : null}
          {plan.stored?.source !== "gemini" ? (
            <Button
              label={replanning ? "Gemini réfléchit…" : "Replanifier avec Gemini"}
              kind="secondary"
              small
              disabled={replanning}
              onPress={async () => {
                setReplanning(true);
                setReplanError(null);
                await act(() => repo.replanSession(plan.item.sessionId, plan.date), setReplanError);
                setReplanning(false);
              }}
            />
          ) : null}
          <ErrorText message={replanError} />
          {plan.exercises.map((e) => (
            <ExerciseRow key={e.id} e={e} planned={plan.stored?.date === plan.date ? plan.stored.exercises.find((p) => p.exerciseId === e.exerciseId) : undefined} />
          ))}
          <ProblemSheet
            target={reporting ? { programSessionId: plan.item.sessionId, name: plan.item.name, date: plan.date } : null}
            onClose={() => setReporting(false)}
          />
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

function ExerciseRow({ e, planned }: { e: SessionExercise; planned?: StoredPlan["exercises"][number] }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Txt kind="heading" style={{ width: 24 }}>{e.position}</Txt>
        <View style={{ flex: 1 }}>
          <Txt kind="strong">{e.name}</Txt>
          <Txt kind="caption" muted>
            {plural(e.sets, "série", "séries")} · {GOAL_LABELS[e.goal]}
          </Txt>
          {planned ? (
            <Txt kind="caption">
              Prévu : {planned.weight === null ? "" : `${String(planned.weight).replace(".", ",")} kg · `}
              {planned.sets} × {planned.equipment === TIMED ? `${planned.reps} s` : planned.reps}
            </Txt>
          ) : null}
          {planned?.warnings.map((w) => (
            <Txt key={w} kind="caption" muted>{w}</Txt>
          ))}
        </View>
      </View>
    </Card>
  );
}
