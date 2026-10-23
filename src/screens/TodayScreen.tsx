import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { SessionExercise, StoredPlan } from "../data/repo";
import { addDays, todayIso } from "../domain/dates";
import { longDate, plural } from "../domain/format";
import type { RootParams } from "../navigation";
import { TIMED } from "../rules/rules";
import { Icon } from "../ui/icons";
import { Button, Card, ErrorText, GoalBadge, IconButton, ListCard, RecommendationNote, Screen, Slab, StatusBadge, Txt } from "../ui/kit";
import { size, space, useColors } from "../ui/theme";
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

  const program = useQuery((r) => r.getActiveProgram());
  const c = useColors();
  const isToday = plan?.date === today;

  return (
    <Screen
      title={plan ? plan.item.name : "Aujourd'hui"}
      subtitle={plan ? undefined : longDate(today)}
      lead={plan && program ? `${program.name} · ${plural(plan.item.setCount, "série", "séries")} aujourd'hui` : undefined}
      left={
        plan ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            <Txt kind="caps" muted>{longDate(plan.date)}</Txt>
            {isToday ? <StatusBadge state="today" /> : <StatusBadge state="planned" />}
          </View>
        ) : undefined
      }
      right={<IconButton icon="sliders" label="Réglages" onPress={() => navigation.navigate("Réglages")} style={{ marginRight: -space[3] }} />}
      brand
    >
      {plan === undefined ? null : plan === null ? (
        <Card>
          <Txt kind="heading">Pas de séance prévue</Txt>
          <Txt muted>Crée un programme dans l'onglet Programme pour voir ta prochaine séance ici.</Txt>
        </Card>
      ) : (
        <>
          {plan.stored?.summary ? (
            <Slab overline="Cette séance">
              <Txt kind="bodyLg" style={{ color: c.onContrast }}>{plan.stored.summary}</Txt>
            </Slab>
          ) : null}
          {plan.stored?.note ? <Txt kind="caption" muted>{plan.stored.note}</Txt> : null}
          {plan.reports.map((r) => (
            <Card key={r.id} style={{ borderColor: c.warning }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <Icon name="alert" color={c.warningInk} size={size.iconSm} />
                <Txt kind="caps" style={{ color: c.warningInk }}>Problème signalé</Txt>
              </View>
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
          <ListCard
            header="Plan de la séance"
            aside={`${plural(plan.item.exerciseCount, "exercice", "exercices")} · ${plural(plan.item.setCount, "série", "séries")}`}
          >
            {plan.exercises.map((e) => (
              <ExerciseRow key={e.id} e={e} planned={plan.stored?.date === plan.date ? plan.stored.exercises.find((p) => p.exerciseId === e.exerciseId) : undefined} />
            ))}
          </ListCard>
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
          {plan.date <= today ? (
            <Button large label="Commencer la séance" onPress={() => navigation.navigate("Log", { programSessionId: plan.item.sessionId, date: plan.date })} />
          ) : null}
          <Button kind="ghost" label="Signaler un problème" onPress={() => setReporting(true)} />
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
  const c = useColors();
  const load = planned ? (planned.weight === null ? null : `${String(planned.weight).replace(".", ",")} kg`) : null;
  const reps = planned ? (planned.equipment === TIMED ? `${planned.reps} s` : String(planned.reps)) : null;
  return (
    <View style={{ padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Txt kind="heading" muted style={{ width: 24 }}>{e.position}</Txt>
        <View style={{ flex: 1, gap: space[1] }}>
          <Txt kind="strong">{e.name}</Txt>
          <GoalBadge goal={e.goal} label={GOAL_LABELS[e.goal]} />
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {planned ? (
            <Txt kind="heading">
              {load ? `${load} ` : ""}
              <Txt kind="heading" muted>×</Txt> {reps}
            </Txt>
          ) : (
            <Txt kind="caption" muted>{plural(e.sets, "série", "séries")}</Txt>
          )}
          {planned ? <Txt kind="caption" muted>{plural(planned.sets, "série", "séries")}</Txt> : null}
        </View>
      </View>
      {planned?.reason ? <RecommendationNote text={planned.reason} flag={planned.warnings[0]} /> : null}
      {!planned?.reason && planned?.warnings.map((w) => (
        <Txt key={w} kind="caption" style={{ color: c.warningInk }}>{w}</Txt>
      ))}
    </View>
  );
}
