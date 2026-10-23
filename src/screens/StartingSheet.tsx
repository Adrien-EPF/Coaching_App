import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useAction, useStore } from "../data/RepoContext";
import type { Estimate, NewExercise } from "../data/repo";
import { todayIso } from "../domain/dates";
import type { RootParams } from "../navigation";
import { hasNoLoad, TIMED } from "../rules/rules";
import { Button, Card, ErrorText, Field, GoalBadge, Row, Sheet, Txt } from "../ui/kit";
import { radius, space, useColors } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";

type Method = "init" | "estimate" | "test";

const METHODS: { id: Method; title: string; text: string }[] = [
  { id: "init", title: "Poids initiaux", text: "Tu connais tes charges : tu les saisis toi-même." },
  { id: "test", title: "Séance test", text: "Gemini planifie une séance pour mesurer ton niveau sur ces exercices." },
  { id: "estimate", title: "Estimations de départ", text: "Gemini propose des charges depuis tes mouvements proches et la place de l'exercice dans la séance." },
];

interface Draft {
  weight: string;
  reps: string;
}

const parseWeight = (t: string) => (t.trim() === "" ? null : Number(t.replace(",", ".")));

/** First loads for the Exercises with no history: typed, estimated by Gemini, or measured in a Test Session. */
export function StartingSheet({ visible, onClose, exercises }: { visible: boolean; onClose: () => void; exercises: NewExercise[] }) {
  const c = useColors();
  const { repo, changed } = useStore();
  const act = useAction();
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const [method, setMethod] = useState<Method>("init");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftOf = (e: NewExercise): Draft => drafts[e.exerciseId] ?? { weight: e.start?.weight != null ? String(e.start.weight) : "", reps: String(e.start?.reps ?? "") };
  const setDraft = (id: number, patch: Partial<Draft>, base: Draft) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? base), ...patch } }));

  const done = () => {
    setError(null);
    setEstimates(null);
    setDrafts({});
    onClose();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveTyped = (list: { e: { exerciseId: number }; d: Draft }[], origin: "manual" | "estimate") =>
    run(async () => {
      const ok = await act(
        () => repo.setStartingWeights(list.map(({ e, d }) => ({ exerciseId: e.exerciseId, weight: parseWeight(d.weight), reps: Number(d.reps) })), origin, todayIso()),
        setError,
      );
      if (ok) done();
    });

  const programIdOf = async () => {
    const p = await repo.getActiveProgram();
    if (!p) throw new Error("Aucun programme actif.");
    return p.id;
  };

  return (
    <Sheet visible={visible} title="Charges de départ" onClose={done}>
      <Txt muted>
        {exercises.length === 1 ? "1 exercice n'a" : `${exercises.length} exercices n'ont`} pas d'historique. Comment fixer {exercises.length === 1 ? "sa première charge" : "leurs premières charges"} ?
      </Txt>
      <View style={{ gap: space[2] }}>
        {METHODS.map((m) => {
          const on = m.id === method;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setMethod(m.id)}
              style={{
                flexDirection: "row",
                gap: space[3],
                padding: space[4],
                borderRadius: radius.lg,
                borderWidth: on ? 2 : 1.5,
                borderColor: on ? c.contrast : c.lineStrong,
                backgroundColor: c.surfaceRaised,
              }}
            >
              <View style={{ width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2, borderColor: on ? c.contrast : c.lineStrong, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                {on ? <View style={{ width: 12, height: 12, borderRadius: radius.pill, backgroundColor: c.contrast }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt kind="strong">{m.title}</Txt>
                <Txt kind="caption" muted>{m.text}</Txt>
              </View>
            </Pressable>
          );
        })}
      </View>

      {method === "init" && (
        <>
          {exercises.map((e) => {
            const d = draftOf(e);
            return (
              <Card key={e.exerciseId}>
                <Txt kind="strong">{e.name}</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <GoalBadge goal={e.goal} label={GOAL_LABELS[e.goal]} />
                  <Txt kind="caption" muted>place {e.position} sur {e.sessionSize}</Txt>
                </View>
                <Row wrap={false}>
                  {!hasNoLoad(e.equipment) && (
                    <View style={{ flex: 1 }}>
                      <Field label="Charge (kg)" value={d.weight} onChangeText={(t) => setDraft(e.exerciseId, { weight: t }, d)} keyboardType="decimal-pad" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Field label={e.equipment === TIMED ? "Durée (s)" : "Reps"} value={d.reps} onChangeText={(t) => setDraft(e.exerciseId, { reps: t }, d)} keyboardType="number-pad" />
                  </View>
                </Row>
              </Card>
            );
          })}
          <ErrorText message={error} />
          <Button label="Enregistrer les poids initiaux" disabled={busy} onPress={() => saveTyped(exercises.map((e) => ({ e, d: draftOf(e) })), "manual")} />
        </>
      )}

      {method === "estimate" && (
        <>
          {estimates === null ? (
            <Button
              label={busy ? "Gemini réfléchit…" : "Demander les estimations à Gemini"}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  const list = await repo.proposeEstimates(await programIdOf());
                  setDrafts(Object.fromEntries(list.map((x) => [x.exerciseId, { weight: x.weight === null ? "" : String(x.weight), reps: String(x.reps) }])));
                  setEstimates(list);
                })
              }
            />
          ) : (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt kind="caps" muted>Estimations de Gemini</Txt>
                <Txt kind="caption" muted>À approuver ou modifier</Txt>
              </View>
              {estimates.map((x) => {
                const d = drafts[x.exerciseId] ?? { weight: "", reps: "" };
                return (
                  <Card key={x.exerciseId}>
                    <Txt kind="strong">{x.name}</Txt>
                    <GoalBadge goal={x.goal} label={GOAL_LABELS[x.goal]} />
                    <Row wrap={false}>
                      {x.weight !== null && (
                        <View style={{ flex: 1 }}>
                          <Field label="Charge (kg)" value={d.weight} onChangeText={(t) => setDraft(x.exerciseId, { weight: t }, d)} keyboardType="decimal-pad" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Field label={x.equipment === TIMED ? "Durée (s)" : "Reps"} value={d.reps} onChangeText={(t) => setDraft(x.exerciseId, { reps: t }, d)} keyboardType="number-pad" />
                      </View>
                    </Row>
                    {x.why ? <Txt kind="caption" muted>{x.why}</Txt> : null}
                  </Card>
                );
              })}
              <ErrorText message={error} />
              <Button label="Approuver et démarrer" disabled={busy} onPress={() => saveTyped(estimates.map((x) => ({ e: x, d: drafts[x.exerciseId] })), "estimate")} />
            </>
          )}
          {estimates === null && <ErrorText message={error} />}
        </>
      )}

      {method === "test" && (
        <>
          <Txt kind="caption" muted>La séance test a lieu aujourd'hui. Tu la saisis comme n'importe quelle séance ; elle sert ensuite de point de départ aux prochaines.</Txt>
          <ErrorText message={error} />
          <Button
            label={busy ? "Gemini planifie…" : "Planifier la séance test"}
            disabled={busy}
            onPress={() =>
              run(async () => {
                const today = todayIso();
                const test = await repo.createTestSession(await programIdOf(), today);
                changed();
                done();
                navigation.navigate("Log", { programSessionId: test.sessionId, date: test.date });
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}
