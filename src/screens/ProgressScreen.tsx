import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "../data/RepoContext";
import type { ExerciseProgress } from "../data/repo";
import { shortDate } from "../domain/format";
import { Card, Chip, Row, Screen, Txt } from "../ui/kit";
import { space, useColors } from "../ui/theme";

const fmtKg = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;

export function ProgressScreen() {
  const progress = useQuery((repo) => repo.getProgress());
  const [picked, setPicked] = useState<number | null>(null);

  const shown = (progress ?? []).filter((p) => picked === null || p.exerciseId === picked);

  return (
    <Screen title="Progrès">
      {progress === undefined ? null : progress.length === 0 ? (
        <Card>
          <Txt kind="heading">Pas encore de record</Txt>
          <Txt muted>Tes records et ton 1RM estimé apparaîtront ici dès que tu auras validé une séance.</Txt>
        </Card>
      ) : (
        <>
          <Row>
            <Chip label="Tous" selected={picked === null} onPress={() => setPicked(null)} />
            {progress.map((p) => (
              <Chip key={p.exerciseId} label={p.name} selected={picked === p.exerciseId} onPress={() => setPicked(p.exerciseId)} />
            ))}
          </Row>
          {shown.map((p) => (
            <ExerciseRecords key={p.exerciseId} progress={p} />
          ))}
          <Txt kind="caption" muted>1RM estimé avec Epley, sur la charge soulevée uniquement.</Txt>
        </>
      )}
    </Screen>
  );
}

function ExerciseRecords({ progress }: { progress: ExerciseProgress }) {
  const c = useColors();
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space[3] }}>
        <Txt kind="heading" style={{ flex: 1 }}>{progress.name}</Txt>
        <View style={{ alignItems: "flex-end" }}>
          <Txt kind="caps" muted>1RM estimé</Txt>
          <Txt kind="heading">{fmtKg(progress.estimatedOneRepMax)}</Txt>
        </View>
      </View>
      <Txt kind="caps" muted>PR par nombre de reps</Txt>
      {progress.records.map((r) => (
        <View
          key={r.reps}
          style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: c.line }}
        >
          <Txt kind="heading" style={{ width: 44 }}>{r.reps}</Txt>
          <Txt kind="strong" style={{ flex: 1 }}>{fmtKg(r.weight)}</Txt>
          <Txt kind="caption" muted>{shortDate(r.date)}</Txt>
        </View>
      ))}
    </Card>
  );
}
