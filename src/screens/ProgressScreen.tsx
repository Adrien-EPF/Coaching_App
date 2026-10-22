import React, { useState } from "react";
import { View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import type { ExerciseProgress } from "../data/repo";
import { todayIso } from "../domain/dates";
import { shortDate } from "../domain/format";
import { Button, Card, Chip, ErrorText, Row, Screen, Txt } from "../ui/kit";
import { space, useColors } from "../ui/theme";
import { AdherenceCard } from "./AdherenceCard";
import { ObjectivesCard } from "./ObjectivesCard";

const fmtKg = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;

export function ProgressScreen() {
  const { repo } = useStore();
  const act = useAction();
  const progress = useQuery((repo) => repo.getProgress());
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <Button
            label={busy ? "Estimation en cours…" : "Estimer les 1RM avec Gemini"}
            kind="secondary"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              await act(() => repo.estimateOneRepMaxesWithGemini(todayIso()), setError);
              setBusy(false);
            }}
          />
          <ErrorText message={error} />
          <Row>
            <Chip label="Tous" selected={picked === null} onPress={() => setPicked(null)} />
            {progress.map((p) => (
              <Chip key={p.exerciseId} label={p.name} selected={picked === p.exerciseId} onPress={() => setPicked(p.exerciseId)} />
            ))}
          </Row>
          {shown.map((p) => (
            <ExerciseRecords key={p.exerciseId} progress={p} />
          ))}
          <Txt kind="caption" muted>1RM estimé avec Epley, ou par Gemini quand tu le demandes. Sur la charge soulevée uniquement.</Txt>
        </>
      )}
      <ObjectivesCard />
      <AdherenceCard />
    </Screen>
  );
}

function ExerciseRecords({ progress }: { progress: ExerciseProgress }) {
  const c = useColors();
  const gemini = progress.geminiOneRepMax;
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space[3] }}>
        <Txt kind="heading" style={{ flex: 1 }}>{progress.name}</Txt>
        <View style={{ alignItems: "flex-end" }}>
          <Txt kind="caps" muted>{gemini ? "1RM estimé · Gemini" : "1RM estimé"}</Txt>
          <Txt kind="heading">{fmtKg(gemini ? gemini.value : progress.estimatedOneRepMax)}</Txt>
          {gemini && <Txt kind="caption" muted>Epley : {fmtKg(progress.estimatedOneRepMax)}</Txt>}
        </View>
      </View>
      {gemini?.why ? <Txt kind="caption" muted>{gemini.why}</Txt> : null}
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
