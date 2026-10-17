import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "../data/RepoContext";
import type { AdherenceBucket } from "../domain/adherence";
import { todayIso } from "../domain/dates";
import { MONTHS } from "../domain/format";
import { Card, Chip, ProgressBar, Row, Txt } from "../ui/kit";
import { space } from "../ui/theme";

const label = (period: string) => (period.length === 4 ? period : `${MONTHS[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`);

/** Adhérence: Sessions done versus planned, per month or per year. */
export function AdherenceCard() {
  const data = useQuery((repo) => repo.getAdherence(todayIso()));
  const [view, setView] = useState<"months" | "years">("months");
  if (!data) return null;
  const buckets: AdherenceBucket[] = [...data[view]].reverse();

  return (
    <Card>
      <Txt kind="heading">Adhérence</Txt>
      <Row>
        <Chip label="Par mois" selected={view === "months"} onPress={() => setView("months")} />
        <Chip label="Par an" selected={view === "years"} onPress={() => setView("years")} />
      </Row>
      {buckets.length === 0 ? (
        <Txt muted>Les séances faites et prévues apparaîtront ici.</Txt>
      ) : (
        buckets.map((b) => {
          const pct = Math.round((b.done / b.planned) * 100);
          return (
            <View key={b.period} style={{ gap: space[1] }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt kind="strong">{label(b.period)}</Txt>
                <Txt kind="strong">
                  {b.done} / {b.planned} · {pct} %
                </Txt>
              </View>
              <ProgressBar pct={pct} />
            </View>
          );
        })
      )}
    </Card>
  );
}
