import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import type { ExerciseProgress } from "../data/repo";
import { todayIso } from "../domain/dates";
import { fmtNum, shortDate } from "../domain/format";
import type { RootParams } from "../navigation";
import { Icon } from "../ui/icons";
import { Button, Card, Chip, ErrorText, ListCard, Row, Screen, Txt } from "../ui/kit";
import { fonts, radius, space, useColors } from "../ui/theme";
import { ActivityCard } from "./ActivityCard";
import { AdherenceCard } from "./AdherenceCard";
import { ObjectivesCard } from "./ObjectivesCard";


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
      <ActivityCard />
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
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const gemini = progress.geminiOneRepMax;
  const today = todayIso();
  return (
    <View style={{ gap: space[3] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${progress.name} : voir la courbe du 1RM`} onPress={() => navigation.navigate("Exercice", { exerciseId: progress.exerciseId })}>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt kind="caps" muted style={{ flex: 1 }}>{progress.name} · {gemini ? "1RM estimé par Gemini" : "1RM estimé"}</Txt>
            <Icon name="next" color={c.inkMuted} size={20} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 72, lineHeight: 72, color: c.ink, fontVariant: ["tabular-nums"] }}>
              {fmtNum(gemini ? gemini.value : progress.estimatedOneRepMax)}
            </Text>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: c.ink, textTransform: "uppercase" }}>kg</Text>
          </View>
          {gemini ? <Txt kind="caption" muted>Epley : {fmtNum(progress.estimatedOneRepMax)} kg</Txt> : null}
          {gemini?.why ? <Txt kind="caption" muted>{gemini.why}</Txt> : null}
        </Card>
      </Pressable>
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
