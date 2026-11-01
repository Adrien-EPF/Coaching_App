import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery } from "../data/RepoContext";
import { toDate, todayIso } from "../domain/dates";
import { fmtNum, shortDate, tinyDate } from "../domain/format";
import { DEFAULT_PERIOD, Period, goalChanges, oneRmSeries } from "../domain/progressSeries";
import type { RootParams } from "../navigation";
import { LegendItem, LineChart, PeriodPicker } from "../ui/charts";
import { Card, Screen, Txt } from "../ui/kit";
import { space, useColors } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";

const dayNumber = (iso: string) => toDate(iso).getTime() / 86_400_000;

/** One Exercise in Progrès: its Estimated 1RM over time, with the Training Goal changes and its Objective. */
export function ExerciseScreen() {
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const { exerciseId } = useRoute<RouteProp<RootParams, "Exercice">>().params;
  const c = useColors();
  const history = useQuery((repo) => repo.getExerciseHistory(exerciseId), [exerciseId]);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [selected, setSelected] = useState<number | null>(null);
  const today = todayIso();

  const points = useMemo(() => (history ? oneRmSeries(history.sets, period, today) : []), [history, period, today]);
  // Found on the whole history, so a change just before the window still shows on its first point.
  const changes = useMemo(() => (history ? goalChanges(oneRmSeries(history.sets, "all", today)).filter((ch) => ch.date >= (points[0]?.date ?? "")) : []), [history, points, today]);
  const goalColor = { strength: c.strength, hypertrophy: c.hypertrophy, endurance: c.endurance };
  const target = history?.targets.at(-1);
  const point = selected === null ? undefined : points[selected];

  return (
    <Screen title={history?.name ?? "Exercice"} subtitle="1RM estimé" onBack={() => navigation.goBack()}>
      <PeriodPicker
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setSelected(null);
        }}
      />
      <Card>
        {history === undefined ? null : points.length === 0 ? (
          <Txt muted>Aucune séance validée sur cette période.</Txt>
        ) : (
          <>
            <View style={{ minHeight: 44 }}>
              {point ? (
                <>
                  <Txt kind="heading">{fmtNum(point.value)} kg</Txt>
                  <Txt kind="caption" muted>{shortDate(point.date)} · {GOAL_LABELS[point.goal]}</Txt>
                </>
              ) : (
                <Txt kind="caption" muted>Touche un point pour voir sa date et sa valeur.</Txt>
              )}
            </View>
            <LineChart
              label={`Courbe du 1RM estimé de ${history.name}`}
              points={points.map((p) => ({ x: dayNumber(p.date), y: p.value }))}
              marks={changes.map((ch) => ({ x: dayNumber(ch.date), color: goalColor[ch.to] }))}
              guides={target ? [{ y: target.oneRepMax, color: c.limeInk }] : []}
              xTicks={[points[0], ...(points.length > 1 ? [points[points.length - 1]] : [])].map((p) => ({ x: dayNumber(p.date), label: tinyDate(p.date) }))}
              selected={selected}
              onSelect={setSelected}
              formatY={fmtNum}
            />
            <View style={{ gap: space[1] }}>
              {changes.map((ch) => (
                <LegendItem key={ch.date} color={goalColor[ch.to]} label={`${shortDate(ch.date)} : passage en ${GOAL_LABELS[ch.to]}`} />
              ))}
              {target ? (
                <LegendItem
                  dashed
                  color={c.limeInk}
                  label={`Objectif : ${target.reps} reps à ${fmtNum(target.weight)} kg, soit ${fmtNum(target.oneRepMax)} kg de 1RM (avant le ${shortDate(target.byDate)})`}
                />
              ) : null}
            </View>
          </>
        )}
      </Card>
      <Txt kind="caption" muted>Epley, sur la charge soulevée uniquement. Un point par séance : sa meilleure série.</Txt>
    </Screen>
  );
}
