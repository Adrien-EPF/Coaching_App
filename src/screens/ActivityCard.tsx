import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery } from "../data/RepoContext";
import { todayIso } from "../domain/dates";
import { plural, shortDate, tinyDate } from "../domain/format";
import { DEFAULT_PERIOD, Period, weeklyActivity } from "../domain/progressSeries";
import { Bar, BarChart, LegendItem, PeriodPicker } from "../ui/charts";
import { Card, Txt } from "../ui/kit";
import { space, useColors } from "../ui/theme";

const fmtInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** The header of Progrès: weekly volume and Sessions per week (strength and cardio), over a period. */
export function ActivityCard() {
  const c = useColors();
  const sessions = useQuery((repo) => repo.getActivity());
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [volumeSel, setVolumeSel] = useState<number | null>(null);
  const [countSel, setCountSel] = useState<number | null>(null);
  const today = todayIso();
  const weeks = useMemo(() => weeklyActivity(sessions ?? [], period, today), [sessions, period, today]);
  if (!sessions || sessions.length === 0) return null;

  // Label about six weeks along the axis, whatever the period.
  const every = Math.max(1, Math.ceil(weeks.length / 6));
  const label = (i: number) => (i % every === 0 ? tinyDate(weeks[i].weekStart) : undefined);
  const volumeBars: Bar[] = weeks.map((w, i) => ({ segments: [{ value: w.volume, color: c.strength }], label: label(i) }));
  const countBars: Bar[] = weeks.map((w, i) => ({
    segments: [
      { value: w.strength, color: c.strength },
      { value: w.cardio, color: c.cardio },
    ],
    label: label(i),
  }));
  const vol = volumeSel === null ? undefined : weeks[volumeSel];
  const cnt = countSel === null ? undefined : weeks[countSel];
  const reset = (p: Period) => {
    setPeriod(p);
    setVolumeSel(null);
    setCountSel(null);
  };

  return (
    <Card style={{ gap: space[3] }}>
      <Txt kind="caps" muted>Activité</Txt>
      <PeriodPicker value={period} onChange={reset} />

      <Txt kind="strong">Volume par semaine</Txt>
      <View style={{ minHeight: 40 }}>
        {vol ? (
          <>
            <Txt kind="heading">{fmtInt(vol.volume)} kg</Txt>
            <Txt kind="caption" muted>Semaine du {shortDate(vol.weekStart)}</Txt>
          </>
        ) : (
          <Txt kind="caption" muted>Séries × reps × charge. Touche une barre pour le détail.</Txt>
        )}
      </View>
      <BarChart label="Volume de musculation par semaine" bars={volumeBars} selected={volumeSel} onSelect={setVolumeSel} formatY={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))} />

      <Txt kind="strong">Séances par semaine</Txt>
      <View style={{ minHeight: 40 }}>
        {cnt ? (
          <>
            <Txt kind="heading">
              {plural(cnt.strength, "séance de musculation", "séances de musculation")}
              {cnt.cardio > 0 ? `, ${cnt.cardio} de cardio` : ""}
            </Txt>
            <Txt kind="caption" muted>
              Semaine du {shortDate(cnt.weekStart)}
              {cnt.cardio > 0 ? ` · cardio : ${Math.round(cnt.cardioMin)} min` : ""}
            </Txt>
          </>
        ) : (
          <Txt kind="caption" muted>La durée du cardio s'affiche en touchant une barre.</Txt>
        )}
      </View>
      <BarChart label="Séances par semaine, musculation et cardio" bars={countBars} selected={countSel} onSelect={setCountSel} />
      <View style={{ flexDirection: "row", gap: space[4] }}>
        <LegendItem color={c.strength} label="Musculation" />
        <LegendItem color={c.cardio} label="Cardio" />
      </View>
    </Card>
  );
}
