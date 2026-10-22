import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { ExerciseLogDetail, NumbersLogged, SessionLogDetail, SetLogDetail, StoredPlan } from "../data/repo";
import { todayIso } from "../domain/dates";
import { longDate } from "../domain/format";
import type { RootParams } from "../navigation";
import { DEFAULT_RULES, hasNoLoad, TIMED } from "../rules/rules";
import { Button, Card, Chip, ErrorText, Field, KeyboardView, Row, Sheet, Txt } from "../ui/kit";
import { radius, space, useColors } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";

const fmtKg = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")} kg`);
/** Reps, or seconds for a timed Exercise. */
const fmtReps = (reps: number, equipment: string) => (equipment === TIMED ? `${reps} s` : String(reps));
const fmtNumbers = (n: NumbersLogged, equipment: string) =>
  `${n.weight === null ? "" : `${fmtKg(n.weight)} × `}${fmtReps(n.reps, equipment)} · RPE ${String(n.rpe).replace(".", ",")}`;
const parseNumber = (text: string) => Number(text.trim().replace(",", "."));

/** Séance en cours, then read-only once validated. */
export function LogScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const { params } = useRoute<RouteProp<RootParams, "Log">>();
  const { repo } = useStore();
  const { changed } = useStore();
  const [logId, setLogId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ exercise: ExerciseLogDetail; set: SetLogDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [replanned, setReplanned] = useState<string | null>(null);
  const [validated, setValidated] = useState<StoredPlan | "none" | null>(null);

  useEffect(() => {
    repo.startSession(params.programSessionId, params.date).then(setLogId, (e) => setError(String(e.message ?? e)));
  }, [repo, params.programSessionId, params.date]);

  const log = useQuery<SessionLogDetail | null>(async (r) => (logId === null ? null : r.getSessionLog(logId)), [logId]);
  const frozen = log?.status === "validated";

  const validate = async () => {
    if (logId === null) return;
    setError(null);
    setValidating(true);
    try {
      const { plan } = await repo.validateSession(logId, todayIso());
      setValidated(plan ?? "none");
      changed(); // reload every screen
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  };

  return (
    <KeyboardView style={{ backgroundColor: c.surface }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[8], gap: space[4] }}
      keyboardShouldPersistTaps="handled"
    >
      <Row wrap={false}>
        <Button label="‹ Retour" kind="secondary" small onPress={() => navigation.goBack()} />
      </Row>
      <View>
        <Txt kind="caps" muted>{longDate(params.date)}</Txt>
        <Txt kind="title">{log?.name ?? "Séance"}</Txt>
      </View>

      {validated ? (
        <ValidationResult plan={validated === "none" ? null : validated} onDone={() => navigation.goBack()} />
      ) : (
        <>
          {frozen && (
            <Card>
              <Txt kind="strong">Séance validée</Txt>
              <Txt muted>Corriger une série replanifie la prochaine séance.</Txt>
              {replanned ? <Txt kind="caption">{replanned}</Txt> : null}
            </Card>
          )}
          {log?.exercises.map((e) => (
            <ExerciseCard
              key={e.exerciseId}
              logId={log.id}
              exercise={e}
              frozen={frozen}
              onEdit={(set) => setEditing({ exercise: e, set })}
            />
          ))}
          {log && !frozen && (
            <View style={{ gap: space[2] }}>
              <ErrorText message={error} />
              {log.remaining > 0 && (
                <Txt muted>
                  {log.remaining === 1 ? "1 série reste" : `${log.remaining} séries restent`} à saisir ou à marquer comme non faite.
                </Txt>
              )}
              <Button label={validating ? "Planification de la prochaine séance…" : "Valider la séance"} disabled={log.remaining > 0 || validating} onPress={validate} />
            </View>
          )}
        </>
      )}

      <SetSheet
        target={editing}
        validated={frozen}
        onReplanned={(plan) => setReplanned(plan ? `Prochaine séance replanifiée : ${longDate(plan.date)}. ${plan.summary}.` : null)}
        onClose={() => setEditing(null)}
      />
    </ScrollView>
    </KeyboardView>
  );
}

function ExerciseCard({
  logId,
  exercise,
  frozen,
  onEdit,
}: {
  logId: number;
  exercise: ExerciseLogDetail;
  frozen: boolean;
  onEdit: (set: SetLogDetail) => void;
}) {
  const { repo } = useStore();
  const act = useAction();
  const first = exercise.sets[0];
  const bodyweight = hasNoLoad(exercise.equipment);
  const planned =
    first?.plannedReps != null
      ? bodyweight
        ? exercise.equipment === TIMED ? fmtReps(first.plannedReps, exercise.equipment) : `${first.plannedReps} reps`
        : `${fmtKg(first.plannedWeight)} × ${first.plannedReps}`
      : null;
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Txt kind="heading">{exercise.name}</Txt>
          <Txt kind="caption" muted>
            {exercise.position} · {GOAL_LABELS[exercise.goal]}
            {planned ? ` · prévu ${planned}` : ""}
          </Txt>
        </View>
        {!frozen && (
          <Chip
            label={exercise.notCompleted ? "Reprendre" : "Non fait"}
            onPress={() => act(() => repo.setExerciseNotCompleted(logId, exercise.exerciseId, !exercise.notCompleted))}
          />
        )}
      </View>
      {exercise.sets.map((s) => (
        <SetRow key={s.id} set={s} bodyweight={bodyweight} equipment={exercise.equipment} onPress={() => onEdit(s)} />
      ))}
      <Button label="+ série" kind="secondary" small onPress={() => act(() => repo.addSet(logId, exercise.exerciseId))} />
    </Card>
  );
}

function SetRow({ set, bodyweight, equipment, onPress }: { set: SetLogDetail; bodyweight: boolean; equipment: string; onPress: () => void }) {
  const c = useColors();
  const logged = set.reps !== null;
  const done = logged ? `${bodyweight ? "" : `${fmtKg(set.weight)} × `}${fmtReps(set.reps!, equipment)} · RPE ${String(set.rpe).replace(".", ",")}` : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        minHeight: 56,
        paddingHorizontal: space[3],
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: logged ? c.limeInk : c.line,
        backgroundColor: set.notCompleted ? c.surfaceSunken : logged ? c.limeSoft : "transparent",
      }}
    >
      <Txt kind="strong" style={{ width: 24 }}>{set.index + 1}</Txt>
      <View style={{ flex: 1 }}>
        {set.notCompleted ? (
          <Txt kind="strong" muted>Non faite</Txt>
        ) : logged ? (
          <Txt kind="strong">{done}</Txt>
        ) : (
          <Txt kind="strong" muted>
            {set.plannedReps != null ? `Prévu : ${bodyweight ? "" : `${fmtKg(set.plannedWeight)} × `}${fmtReps(set.plannedReps, equipment)}` : "À saisir"}
          </Txt>
        )}
        {set.last && <Txt kind="caption" muted>Dernière fois : {fmtNumbers(set.last, equipment)}</Txt>}
      </View>
    </Pressable>
  );
}

/** Nearest meaning in the Rules' RPE scale at or below the value. */
function rpeMeaning(rpe: number): string {
  const keys = Object.keys(DEFAULT_RULES.rpe_scale).map(Number).sort((a, b) => b - a);
  const key = keys.find((k) => k <= rpe) ?? keys[keys.length - 1];
  return DEFAULT_RULES.rpe_scale[String(key)];
}

const RPE_CHOICES = [5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function SetSheet({
  target,
  validated,
  onReplanned,
  onClose,
}: {
  target: { exercise: ExerciseLogDetail; set: SetLogDetail } | null;
  /** The Session is validated: a change corrects history and re-plans the next Session. */
  validated: boolean;
  onReplanned: (plan: StoredPlan | null) => void;
  onClose: () => void;
}) {
  const { repo } = useStore();
  const act = useAction();
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const { set } = target;
    // Pre-fill: what is logged, else the plan, else last time.
    const w = set.weight ?? set.plannedWeight ?? set.last?.weight ?? null;
    const r = set.reps ?? set.plannedReps ?? set.last?.reps ?? null;
    setWeight(w === null ? "" : String(w).replace(".", ","));
    setReps(r === null ? "" : String(r));
    setRpe(set.rpe ?? set.last?.rpe ?? null);
    setError(null);
  }, [target]);

  if (!target) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;
  const bodyweight = hasNoLoad(target.exercise.equipment);
  const timed = target.exercise.equipment === TIMED;

  const save = async () => {
    if (rpe === null) return setError("Choisis le RPE.");
    const numbers = { weight: bodyweight && weight.trim() === "" ? null : parseNumber(weight), reps: parseNumber(reps), rpe };
    const ok = await act(
      async () => (validated ? onReplanned(await repo.editValidatedSet(target.set.id, numbers, todayIso())) : repo.logSet(target.set.id, numbers)),
      setError,
    );
    if (ok) onClose();
  };

  return (
    <Sheet visible title={`${target.exercise.name} · série ${target.set.index + 1}`} onClose={onClose}>
      {target.set.last && <Txt muted>Dernière fois : {fmtNumbers(target.set.last, target.exercise.equipment)}</Txt>}
      <Row wrap={false}>
        {!bodyweight && (
          <View style={{ flex: 1 }}>
            <Field label="Charge (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Field label={timed ? "Durée (s)" : "Reps"} value={reps} onChangeText={setReps} keyboardType="number-pad" />
        </View>
      </Row>
      <View style={{ gap: space[2] }}>
        <Txt kind="caps" muted>RPE</Txt>
        <Row>
          {RPE_CHOICES.map((v) => (
            <Chip key={v} label={String(v).replace(".", ",")} selected={rpe === v} onPress={() => setRpe(v)} />
          ))}
        </Row>
        {rpe !== null && <Txt kind="caption" muted>{rpeMeaning(rpe)}</Txt>}
      </View>
      <ErrorText message={error} />
      <Button label="Enregistrer" onPress={save} />
      {validated && target.set.notCompleted ? null : (
        <Button
          label={target.set.notCompleted ? "Remettre à saisir" : "Non faite"}
          kind="secondary"
          onPress={async () => {
            const run = validated
              ? async () => onReplanned(await repo.editValidatedSet(target.set.id, "notCompleted", todayIso()))
              : () => repo.setSetNotCompleted(target.set.id, !target.set.notCompleted);
            if (await act(run, setError)) onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function ValidationResult({ plan, onDone }: { plan: StoredPlan | null; onDone: () => void }) {
  return (
    <>
      <Card>
        <Txt kind="heading">Séance validée</Txt>
        <Txt muted>
          {plan
            ? `Prochaine séance : ${longDate(plan.date)}. ${plan.summary}.`
            : "Aucune séance à planifier pour la suite. Ajoute des séances au programme."}
        </Txt>
        {plan && <Txt kind="caption" muted>{plan.source === "gemini" ? "Plan de Gemini" : "Plan des règles seules"}</Txt>}
        {plan?.note && <Txt kind="caption">{plan.note}</Txt>}
      </Card>
      {plan?.exercises.map((e) => (
        <Card key={e.exerciseId}>
          <Txt kind="strong">{e.name}</Txt>
          <Txt>
            {e.weight === null ? "" : `${fmtKg(e.weight)} · `}
            {e.sets} × {fmtReps(e.reps, e.equipment)}
          </Txt>
          {e.reason && <Txt kind="caption" muted>{e.reason}</Txt>}
          {e.warnings.map((w) => (
            <Txt key={w} kind="caption" muted>{w}</Txt>
          ))}
        </Card>
      ))}
      <Button label="Terminer" onPress={onDone} />
    </>
  );
}
