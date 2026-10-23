import React, { useState } from "react";
import { View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { formatFr } from "../domain/format";
import { Button, Card, ProgressBar, SectionLabel, Txt } from "../ui/kit";
import { space } from "../ui/theme";
import { ObjectiveSheet } from "./ObjectiveSheet";

const fmtKg = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;

/** Objectifs: target PRs with a date, and how far the current PR is from each. */
export function ObjectivesCard() {
  const { repo } = useStore();
  const act = useAction();
  const objectives = useQuery((r) => r.getObjectives());
  const [adding, setAdding] = useState(false);

  return (
    <View style={{ gap: space[3] }}>
      <SectionLabel right={<Button label="Ajouter" kind="ghost" small icon="plus" onPress={() => setAdding(true)} />}>Objectifs</SectionLabel>
      {objectives?.length === 0 ? <Txt muted>Fixe-toi un PR à atteindre à une date : il apparaîtra ici avec ta progression.</Txt> : null}
      {(objectives ?? []).map((o) => (
        <Card key={o.id} style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
            <Txt kind="strong" style={{ flex: 1 }}>
              {o.name} · {o.reps} reps
            </Txt>
            <Txt kind="caption" muted>d'ici le {formatFr(o.byDate)}</Txt>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Txt kind="heading">
              {fmtKg(o.current)} <Txt kind="heading" muted>/ {fmtKg(o.weight)}</Txt>
            </Txt>
            <Txt kind="caps">{o.pct} %</Txt>
          </View>
          <ProgressBar pct={o.pct} />
          <Button label="Supprimer" kind="ghost" small onPress={() => act(() => repo.removeObjective(o.id))} />
        </Card>
      ))}
      <ObjectiveSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
