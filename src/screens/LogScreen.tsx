import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { ExerciseLogDetail, NumbersLogged, SessionLogDetail, SetLogDetail, StoredPlan } from "../data/repo";
import { todayIso } from "../domain/dates";
import { longDate } from "../domain/format";
import type { RootParams } from "../navigation";
import { DEFAULT_RULES, hasNoLoad, TIMED } from "../rules/rules";
import { Icon } from "../ui/icons";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  GoalBadge,
  IconButton,
  KeyboardView,
  ListCard,
  ProgressBar,
  RecommendationNote,
  RpePicker,
  Sheet,
  Slab,
  Split,
  StatusBadge,
  Stepper,
  Txt,
} from "../ui/kit";
import { fonts, radius, size, space, useColors } from "../ui/theme";
import { GOAL_LABELS } from "./ProgramScreen";

const num = (n: number) => String(n).replace(".", ",");
const fmtKg = (n: number | null) => (n === null ? "—" : `${num(n)} kg`);
/** A load as shown: a belt's added load carries its sign (+12 kg). */
const fmtLoad = (n: number | null, equipment: string) => (n === null ? "—" : equipment === "weight_belt" ? `+${num(n)} kg` : fmtKg(n));
/** Reps, or seconds for a timed Exercise. */
const fmtReps = (reps: number, equipment: string) => (equipment === TIMED ? `${reps} s` : String(reps));
const fmtNumbers = (n: NumbersLogged, equipment: string) =>
  `${n.weight === null ? "" : `${fmtLoad(n.weight, equipment)} × `}${fmtReps(n.reps, equipment)} · RPE ${num(n.rpe)}`;
const parseNumber = (text: string) => Number(text.trim().replace(",", "."));
const isHandled = (s: SetLogDetail) => s.reps !== null || s.notCompleted;
/** How far one tap on + or − moves the load. */
const stepFor = (equipment: string) => (equipment === "weight_belt" ? 1 : equipment === "barbell" ? 2.5 : 2);

/** Séance en cours, then read-only once validated. */
export function LogScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const { params } = useRoute<RouteProp<RootParams, "Log">>();
  const { repo, changed } = useStore();
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

  const total = log?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const handled = log?.exercises.reduce((n, e) => n + e.sets.filter(isHandled).length, 0) ?? 0;
  const currentIndex = log ? Math.max(0, log.exercises.findIndex((e) => e.sets.some((s) => !isHandled(s)))) : 0;
  const showBar = !!log && !frozen && !validated;

  return (
    <KeyboardView style={{ backgroundColor: c.surface }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: c.surface }}
        contentContainerStyle={{ paddingBottom: insets.bottom + (showBar ? 168 : space[8]), gap: space[5] }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
      >
        <View
          style={{
            backgroundColor: c.contrast,
            paddingTop: insets.top + space[2],
            paddingHorizontal: space[4],
            paddingBottom: space[4],
            borderBottomLeftRadius: radius.lg,
            borderBottomRightRadius: radius.lg,
            gap: space[2],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: -space[3] }}>
            <IconButton icon="back" label="Retour" color={c.onContrast} onPress={() => navigation.goBack()} />
            <Txt kind="caps" style={{ color: c.onContrast }}>{longDate(params.date)}</Txt>
            <View style={{ width: size.tapMin }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[2] }}>
            <Txt kind="title" style={{ color: c.onContrast, flex: 1 }}>{log?.name ?? "Séance"}</Txt>
            {log ? <Txt kind="heading" style={{ color: c.onContrast }}>{handled}/{total}</Txt> : null}
          </View>
          {log && !validated ? (
            <>
              <ProgressBar pct={total ? (handled / total) * 100 : 0} onContrast />
              <Txt kind="caption" style={{ color: c.onContrast }}>
                {frozen
                  ? "Séance validée"
                  : `Exercice ${currentIndex + 1} sur ${log.exercises.length} · ${log.remaining === 1 ? "1 série restante" : `${log.remaining} séries restantes`}`}
              </Txt>
            </>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: space[4], gap: space[5] }}>
          {validated ? (
            <ValidationResult log={log ?? null} plan={validated === "none" ? null : validated} date={params.date} onDone={() => navigation.goBack()} />
          ) : (
            <>
              {frozen && (
                <Card>
                  <StatusBadge state="done" />
                  <Txt muted>Corriger une série replanifie la prochaine séance.</Txt>
                  {replanned ? <Txt kind="caption">{replanned}</Txt> : null}
                </Card>
              )}
              {log?.exercises.map((e, i) => (
                <ExerciseCard
                  key={e.exerciseId}
                  logId={log.id}
                  exercise={e}
                  index={i}
                  count={log.exercises.length}
                  frozen={frozen}
                  onEdit={(set) => setEditing({ exercise: e, set })}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {showBar && log ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.surfaceRaised,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space[4],
            paddingBottom: insets.bottom + space[4],
            gap: space[2],
            elevation: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
          }}
        >
          <ErrorText message={error} />
          {log.remaining > 0 ? (
            <Txt kind="caption" muted style={{ textAlign: "center" }}>Enregistre ou marque « Non effectuée » chaque série pour valider.</Txt>
          ) : null}
          <Button large label={validating ? "Planification de la prochaine séance…" : "Valider la séance"} disabled={log.remaining > 0 || validating} onPress={validate} />
        </View>
      ) : null}

      <SetSheet
        target={editing}
        validated={frozen}
        onReplanned={(plan) => setReplanned(plan ? `Prochaine séance replanifiée : ${longDate(plan.date)}. ${plan.summary}.` : null)}
        onClose={() => setEditing(null)}
      />
    </KeyboardView>
  );
}

function ExerciseCard({
  logId,
  exercise,
  index,
  count,
  frozen,
  onEdit,
}: {
  logId: number;
  exercise: ExerciseLogDetail;
  index: number;
  count: number;
  frozen: boolean;
  onEdit: (set: SetLogDetail) => void;
}) {
  const { repo } = useStore();
  const act = useAction();
  const first = exercise.sets[0];
  const bodyweight = hasNoLoad(exercise.equipment);
  const done = exercise.sets.filter(isHandled).length;
  const allDone = exercise.sets.length > 0 && done === exercise.sets.length;
  const nextPending = exercise.sets.find((s) => !isHandled(s));
  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
        <Txt kind="caps" muted>Exercice {index + 1}/{count}</Txt>
        <GoalBadge goal={exercise.goal} label={GOAL_LABELS[exercise.goal]} />
        {exercise.notCompleted ? <StatusBadge state="notDone" /> : allDone ? <StatusBadge state="done" /> : <StatusBadge state="planned" />}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space[2] }}>
        <Txt kind="titleLg" style={{ flex: 1 }}>{exercise.name}</Txt>
        {!frozen && (
          <Chip
            label={exercise.notCompleted ? "Reprendre" : "Non fait"}
            onPress={() => act(() => repo.setExerciseNotCompleted(logId, exercise.exerciseId, !exercise.notCompleted))}
          />
        )}
      </View>
      {first?.plannedReps != null ? <PlannedHero first={first} equipment={exercise.equipment} bodyweight={bodyweight} /> : null}
      <Txt kind="caption" muted>
        {exercise.sets.length === 1 ? "1 série" : `${exercise.sets.length} séries`} · {done} sur {exercise.sets.length} enregistrée{done > 1 ? "s" : ""}
      </Txt>
      {exercise.sets.map((s) => (
        <SetRow
          key={s.id}
          set={s}
          bodyweight={bodyweight}
          equipment={exercise.equipment}
          current={!frozen && !exercise.notCompleted && s.id === nextPending?.id}
          onPress={() => onEdit(s)}
        />
      ))}
      <Button label="Ajouter une série" kind="secondary" small icon="plus" onPress={() => act(() => repo.addSet(logId, exercise.exerciseId))} />
    </Card>
  );
}

/** The planned numbers of an Exercise as the card's hero: 104 kg × 3. */
function PlannedHero({ first, equipment, bodyweight }: { first: SetLogDetail; equipment: string; bodyweight: boolean }) {
  const c = useColors();
  const big = { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, color: c.ink, fontVariant: ["tabular-nums" as const] };
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
      {bodyweight ? null : <Text style={big}>{fmtLoad(first.plannedWeight, equipment)}</Text>}
      {bodyweight ? null : <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: c.inkMuted }}>×</Text>}
      <Text style={bodyweight ? big : { ...big, fontSize: 32, color: c.inkMuted }}>{fmtReps(first.plannedReps!, equipment)}</Text>
    </View>
  );
}

function SetRow({
  set,
  bodyweight,
  equipment,
  current,
  onPress,
}: {
  set: SetLogDetail;
  bodyweight: boolean;
  equipment: string;
  current: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const logged = set.reps !== null && !set.notCompleted;
  const cell = (label: string, value: string, prefilled: boolean, grow = 1) => (
    <View
      style={{
        flex: grow,
        minHeight: size.controlLg,
        borderRadius: radius.sm,
        paddingHorizontal: space[2],
        paddingVertical: space[1],
        justifyContent: "center",
        backgroundColor: logged ? c.surfaceRaised : c.surfaceSunken,
        borderWidth: logged ? 1.5 : 0,
        borderColor: c.lineStrong,
      }}
    >
      <Txt kind="caps" muted style={{ fontSize: 11, lineHeight: 14 }}>{label}</Txt>
      <Txt kind="heading" style={{ color: prefilled ? c.inkSubtle : c.ink }}>{value}</Txt>
    </View>
  );
  const plannedLoad = set.plannedWeight ?? set.last?.weight ?? null;
  const loadText = logged ? fmtLoad(set.weight, equipment) : plannedLoad !== null ? fmtLoad(plannedLoad, equipment) : "—";
  const repsText = logged ? fmtReps(set.reps!, equipment) : set.plannedReps != null ? fmtReps(set.plannedReps, equipment) : "—";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Série ${set.index + 1}`}
      onPress={onPress}
      style={{
        borderRadius: radius.md,
        borderWidth: current ? 2 : 1,
        borderColor: current ? c.contrast : c.line,
        padding: space[2],
        gap: space[2],
        backgroundColor: c.surfaceRaised,
      }}
    >
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View
          style={{
            width: 48,
            minHeight: size.controlLg,
            borderRadius: radius.sm,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: logged ? c.lime : c.surfaceSunken,
          }}
        >
          {logged ? <Icon name="check" color={c.onLime} size={16} stroke={2.6} /> : set.notCompleted ? <Icon name="cross" color={c.inkMuted} size={16} stroke={2.6} /> : null}
          <Txt kind="titleSm" style={{ color: logged ? c.onLime : c.inkMuted }}>S{set.index + 1}</Txt>
        </View>
        {set.notCompleted ? (
          <View style={{ flex: 1, minHeight: size.controlLg, justifyContent: "center", paddingHorizontal: space[2] }}>
            <Txt kind="strong" muted>Non effectuée</Txt>
          </View>
        ) : (
          <>
            {bodyweight ? null : cell("Charge", loadText, !logged, 2)}
            {cell(equipment === TIMED ? "Durée" : "Reps", repsText, !logged)}
            {cell("RPE", logged && set.rpe !== null ? num(set.rpe) : "—", !logged)}
          </>
        )}
      </View>
      {set.last ? <Txt kind="caption" muted>Dernière fois : {fmtNumbers(set.last, equipment)}</Txt> : null}
    </Pressable>
  );
}

/** Nearest meaning in the Rules' RPE scale at or below the value. */
function rpeMeaning(rpe: number): string {
  const keys = Object.keys(DEFAULT_RULES.rpe_scale).map(Number).sort((a, b) => b - a);
  const key = keys.find((k) => k <= rpe) ?? keys[keys.length - 1];
  return DEFAULT_RULES.rpe_scale[String(key)];
}

/** The scale offered in the picker; the lowest step stands for "6 or less". */
const RPE_STEPS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const stepNumber = (text: string, delta: number) => {
  const n = parseNumber(text);
  const next = Math.max(0, (Number.isNaN(n) ? 0 : n) + delta);
  return num(Math.round(next * 100) / 100);
};

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
    setWeight(w === null ? "" : num(w));
    setReps(r === null ? "" : String(r));
    setRpe(set.rpe ?? set.last?.rpe ?? null);
    setError(null);
  }, [target]);

  if (!target) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;
  const { exercise } = target;
  const bodyweight = hasNoLoad(exercise.equipment);
  const timed = exercise.equipment === TIMED;
  const step = stepFor(exercise.equipment);
  const maxToClimb = DEFAULT_RULES.goals[exercise.goal].max_rpe_to_increase;
  const first = exercise.sets[0];

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
    <Sheet visible overline={`Série ${target.set.index + 1} sur ${exercise.sets.length}`} title={exercise.name} onClose={onClose}>
      {target.set.last && <Txt muted>Dernière fois : {fmtNumbers(target.set.last, exercise.equipment)}</Txt>}
      {!bodyweight && (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt kind="caps" muted>{exercise.equipment === "weight_belt" ? "Charge ajoutée" : "Charge"}</Txt>
            <Txt kind="caption" muted>pas de {num(step)} kg</Txt>
          </View>
          <Stepper value={weight} onChange={setWeight} onMinus={() => setWeight(stepNumber(weight, -step))} onPlus={() => setWeight(stepNumber(weight, step))} />
        </View>
      )}
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt kind="caps" muted>{timed ? "Durée (s)" : "Reps"}</Txt>
          {first?.plannedReps != null ? <Txt kind="caption" muted>Prévu : {fmtReps(first.plannedReps, exercise.equipment)}</Txt> : null}
        </View>
        <Stepper keyboardType="number-pad" value={reps} onChange={setReps} onMinus={() => setReps(stepNumber(reps, -1))} onPlus={() => setReps(stepNumber(reps, 1))} />
      </View>
      <RpePicker value={rpe} onChange={setRpe} steps={RPE_STEPS} maxToClimb={maxToClimb} meaning={rpe !== null ? rpeMeaning(rpe) : null} />
      <ErrorText message={error} />
      <Split>
        {validated && target.set.notCompleted ? (
          <View />
        ) : (
          <Button
            label={target.set.notCompleted ? "Remettre à saisir" : "Non effectuée"}
            kind="secondary"
            onPress={async () => {
              const run = validated
                ? async () => onReplanned(await repo.editValidatedSet(target.set.id, "notCompleted", todayIso()))
                : () => repo.setSetNotCompleted(target.set.id, !target.set.notCompleted);
              if (await act(run, setError)) onClose();
            }}
          />
        )}
        <Button label="Enregistrer" onPress={save} />
      </Split>
    </Sheet>
  );
}

/** After validation: the summary of what was done, then the next Session as Gemini or the Rules planned it. */
function ValidationResult({
  log,
  plan,
  date,
  onDone,
}: {
  log: SessionLogDetail | null;
  plan: StoredPlan | null;
  date: string;
  onDone: () => void;
}) {
  const c = useColors();
  const skipped = log?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.notCompleted).length, 0) ?? 0;
  const total = log?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  return (
    <>
      <View style={{ gap: space[2] }}>
        <StatusBadge state="done" />
        <Txt muted>
          {longDate(date)}
          {log ? ` · ${total - skipped} séries sur ${total}${skipped ? `, ${skipped} non effectuée${skipped > 1 ? "s" : ""}` : ""}` : ""}
        </Txt>
      </View>

      {log ? (
        <ListCard header="Bilan">
          {log.exercises.map((e) => {
            const done = e.sets.filter((s) => s.reps !== null && !s.notCompleted);
            const missed = e.sets.length - done.length;
            const bodyweight = hasNoLoad(e.equipment);
            const weight = done[0]?.weight ?? null;
            return (
              <View key={e.exerciseId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], padding: space[4] }}>
                <View style={{ flex: 1 }}>
                  <Txt kind="strong">{e.name}</Txt>
                  <Txt kind="caption" muted>
                    {done.length === 0
                      ? "non effectuée"
                      : `${bodyweight ? "" : `${fmtLoad(weight, e.equipment)} × `}${done.map((s) => fmtReps(s.reps!, e.equipment)).join(" · ")}`}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                  <Icon name={missed ? "cross" : "check"} color={missed ? c.dangerInk : c.limeInk} size={16} stroke={2.6} />
                  <Txt kind="caps" style={{ color: missed ? c.dangerInk : c.limeInk }}>
                    {missed ? `${missed} non eff.` : `${done.length}/${e.sets.length}`}
                  </Txt>
                </View>
              </View>
            );
          })}
        </ListCard>
      ) : null}

      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[3] }}>
          <Txt kind="heading" style={{ textTransform: "uppercase" }}>Prochaine séance</Txt>
          {plan ? <Txt kind="caps" muted>{longDate(plan.date)}</Txt> : null}
        </View>
        {plan ? (
          <>
            <Slab overline={plan.source === "gemini" ? "Plan de Gemini" : "Plan des règles seules"}>
              <Txt kind="bodyLg" style={{ color: c.onContrast }}>{plan.summary}</Txt>
            </Slab>
            {plan.note ? <Txt kind="caption" muted>{plan.note}</Txt> : null}
            <ListCard>
              {plan.exercises.map((e) => (
                <View key={e.exerciseId} style={{ padding: space[4], gap: space[2] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
                    <Txt kind="strong" style={{ flex: 1 }}>{e.name}</Txt>
                    <Txt kind="heading">
                      {e.weight === null ? "" : `${fmtLoad(e.weight, e.equipment)} `}
                      <Txt kind="heading" muted>×</Txt> {fmtReps(e.reps, e.equipment)}
                    </Txt>
                  </View>
                  {e.reason ? <RecommendationNote text={e.reason} flag={e.warnings[0]} /> : null}
                  {!e.reason && e.warnings.map((w) => <Txt key={w} kind="caption" muted>{w}</Txt>)}
                </View>
              ))}
            </ListCard>
          </>
        ) : (
          <Txt muted>Aucune séance à planifier pour la suite. Ajoute des séances au programme.</Txt>
        )}
      </View>
      <Button large label="Terminer" onPress={onDone} />
    </>
  );
}
