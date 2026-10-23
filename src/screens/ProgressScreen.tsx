import React, { useState } from "react";
import { Text, View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import type { ExerciseProgress } from "../data/repo";
import { todayIso } from "../domain/dates";
import { shortDate } from "../domain/format";
import { Button, Card, Chip, ErrorText, ListCard, Row, Screen, Txt } from "../ui/kit";
import { fonts, radius, space, useColors } from "../ui/theme";
import { AdherenceCard } from "./AdherenceCard";
import { ObjectivesCard } from "./ObjectivesCard";

const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

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
          <Button
            label={busy ? "Estimation en cours…" : "Estimer les 1RM avec Gemini"}
            kind="secondary"
            small
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              await act(() => repo.estimateOneRepMaxesWithGemini(todayIso()), setError);
              setBusy(false);
            }}
          />
          <ErrorText message={error} />
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
  const today = todayIso();
  return (
    <View style={{ gap: space[3] }}>
      <Card>
        <Txt kind="caps" muted>{progress.name} · {gemini ? "1RM estimé par Gemini" : "1RM estimé"}</Txt>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 72, lineHeight: 72, color: c.ink, fontVariant: ["tabular-nums"] }}>
            {fmtNum(gemini ? gemini.value : progress.estimatedOneRepMax)}
          </Text>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: c.ink, textTransform: "uppercase" }}>kg</Text>
        </View>
        {gemini ? <Txt kind="caption" muted>Epley : {fmtNum(progress.estimatedOneRepMax)} kg</Txt> : null}
        {gemini?.why ? <Txt kind="caption" muted>{gemini.why}</Txt> : null}
      </Card>
      <ListCard header="PR par nombre de reps">
        {progress.records.map((r) => {
          const fresh = r.date === today;
          return (
            <View
              key={r.reps}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[3],
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                backgroundColor: fresh ? c.limeSoft : "transparent",
              }}
            >
              <Txt kind="caps" muted style={{ width: 64 }}>{r.reps} {r.reps === 1 ? "rep" : "reps"}</Txt>
              <Txt kind="heading" style={{ flex: 1 }}>{fmtNum(r.weight)} kg</Txt>
              <Txt kind="caption" muted>{fresh ? "Aujourd'hui" : shortDate(r.date)}</Txt>
              {fresh ? (
                <View style={{ backgroundColor: c.lime, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 2 }}>
                  <Txt kind="caps" style={{ color: c.onLime }}>PR</Txt>
                </View>
              ) : null}
            </View>
          );
        })}
      </ListCard>
    </View>
  );
}
