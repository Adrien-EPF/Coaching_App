import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { ProgramDetail, SessionExercise, TrainingGoal } from "../data/repo";
import { CYCLE_LABELS, CycleKind, slotCount, slotLabel } from "../domain/cycle";
import { todayIso } from "../domain/dates";
import { formatFr, maskFr, parseFr, plural, shortDate } from "../domain/format";
import { StartingSheet } from "./StartingSheet";
import { DEFAULT_RULES } from "../rules/rules";
import { Icon } from "../ui/icons";
import { Button, Card, Chip, ErrorText, Field, GoalBadge, Row, Screen, SectionLabel, Sheet, Txt } from "../ui/kit";
import { radius, size, space, useColors } from "../ui/theme";

export const GOAL_LABELS: Record<TrainingGoal, string> = {
  strength: "Force",
  endurance: "Endurance",
  hypertrophy: "Hypertrophie",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barre",
  dumbbell: "Haltères",
  machine: "Machine",
  cable: "Poulie",
  weight_belt: "Ceinture de lest",
  bodyweight: "Poids du corps",
  timed: "Durée",
};

export function ProgramScreen() {
  const detail = useQuery<ProgramDetail | null>(async (repo) => {
    const p = await repo.getActiveProgram();
    return p ? repo.getProgramDetail(p.id) : null;
  });
  const fresh = useQuery(async (repo) => {
    const p = await repo.getActiveProgram();
    return p ? repo.exercisesWithoutHistory(p.id) : [];
  });
  const [sheet, setSheet] = useState<
    | { kind: "program" }
    | { kind: "starting" }
    | { kind: "session" }
    | { kind: "exercise"; sessionId: number }
    | { kind: "editExercise"; exercise: SessionExercise }
    | null
  >(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const close = () => setSheet(null);

  if (detail === undefined) return <Screen title="Programme">{null}</Screen>;

  const picked = detail ? (detail.sessions.find((s) => s.id === pickedId) ?? detail.sessions[0]) : undefined;

  return (
    <Screen
      title={detail ? detail.program.name : "Programme"}
      subtitle={detail ? "Programme actif" : undefined}
      lead={detail ? `Depuis le ${shortDate(detail.program.startDate)} · ${plural(detail.sessions.length, "séance", "séances")} par cycle` : undefined}
    >
      {detail ? (
        <>
          <View style={{ gap: space[2] }}>
            <SectionLabel>Cycle</SectionLabel>
            <Row>
              {(Object.keys(CYCLE_LABELS) as CycleKind[]).map((k) => (
                <Chip key={k} label={CYCLE_LABELS[k]} selected={k === detail.program.cycle} />
              ))}
            </Row>
            {detail.program.cycle === "week" ? <WeekStrip sessions={detail.sessions} /> : null}
          </View>

          {fresh && fresh.length > 0 && (
            <Card>
              <Txt kind="heading">Charges de départ</Txt>
              {fresh.some((e) => !e.start) ? (
                <Txt muted>
                  {plural(fresh.filter((e) => !e.start).length, "exercice sans historique", "exercices sans historique")} : {fresh.filter((e) => !e.start).map((e) => e.name).join(", ")}.
                </Txt>
              ) : (
                <Txt muted>Fixées pour {fresh.map((e) => e.name).join(", ")}. Elles servent jusqu'à la première séance validée.</Txt>
              )}
              <Button label={fresh.some((e) => !e.start) ? "Fixer les charges de départ" : "Modifier les charges de départ"} onPress={() => setSheet({ kind: "starting" })} />
            </Card>
          )}

          <View style={{ gap: space[2] }}>
            <SectionLabel>Séances</SectionLabel>
            {detail.sessions.length === 0 && <Txt muted>Aucune séance. Ajoute la première.</Txt>}
            <Row>
              {detail.sessions.map((s) => (
                <Chip key={s.id} label={s.name} selected={s.id === picked?.id} onPress={() => setPickedId(s.id)} />
              ))}
            </Row>
          </View>

          {picked ? (
            <SessionDetail
              cycle={detail.program.cycle}
              session={picked}
              onAddExercise={() => setSheet({ kind: "exercise", sessionId: picked.id })}
              onEditExercise={(exercise) => setSheet({ kind: "editExercise", exercise })}
            />
          ) : null}
          <Button label="Ajouter une séance" kind="secondary" icon="plus" onPress={() => setSheet({ kind: "session" })} />
          <Txt kind="caption" muted>
            Les modifications s'appliquent aux prochaines séances. Les séances passées restent figées.
          </Txt>
        </>
      ) : (
        <Card>
          <Txt kind="heading">Aucun programme</Txt>
          <Txt muted>Crée ton premier programme pour voir tes séances au calendrier.</Txt>
        </Card>
      )}
      <Button label="Nouveau programme" kind={detail ? "ghost" : "primary"} large={!detail} onPress={() => setSheet({ kind: "program" })} />

      <StartingSheet visible={sheet?.kind === "starting"} onClose={close} exercises={fresh ?? []} />
      <ProgramSheet visible={sheet?.kind === "program"} onClose={close} />
      {detail && (
        <>
          <SessionSheet visible={sheet?.kind === "session"} onClose={close} program={detail.program.id} cycle={detail.program.cycle} />
          <ExerciseSheet
            visible={sheet?.kind === "exercise"}
            onClose={close}
            sessionId={sheet?.kind === "exercise" ? sheet.sessionId : 0}
          />
          <EditExerciseSheet
            exercise={sheet?.kind === "editExercise" ? sheet.exercise : null}
            onClose={close}
          />
        </>
      )}
    </Screen>
  );
}

/** The week at a glance: which day each Session falls on. */
function WeekStrip({ sessions }: { sessions: ProgramDetail["sessions"] }) {
  const c = useColors();
  const bySlot = new Map(sessions.map((s) => [s.slot, s]));
  return (
    <View style={{ flexDirection: "row", gap: space[1] }}>
      {Array.from({ length: 7 }, (_, i) => {
        const s = bySlot.get(i);
        return (
          <View key={i} style={{ flex: 1, gap: space[1], alignItems: "center" }}>
            <Txt kind="caps" muted>{["L", "M", "M", "J", "V", "S", "D"][i]}</Txt>
            <View
              style={{
                alignSelf: "stretch",
                height: size.tapMin,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: s ? c.surfaceRaised : c.surfaceSunken,
                borderWidth: s ? 1.5 : 0,
                borderColor: c.lineStrong,
              }}
            >
              <Txt kind="heading" muted={!s}>{s ? s.name.trim().split(/\s+/).pop()!.slice(0, 1).toUpperCase() : "·"}</Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SessionDetail({
  cycle,
  session,
  onAddExercise,
  onEditExercise,
}: {
  cycle: CycleKind;
  session: ProgramDetail["sessions"][number];
  onAddExercise: () => void;
  onEditExercise: (e: SessionExercise) => void;
}) {
  const c = useColors();
  const act = useAction();
  const { repo } = useStore();
  const sets = session.exercises.reduce((n, e) => n + e.sets, 0);
  return (
    <View style={{ gap: space[3] }}>
      <Txt muted>
        {slotLabel(cycle, session.slot)} · {plural(session.exercises.length, "exercice", "exercices")} · {plural(sets, "série", "séries")}
      </Txt>
      {session.exercises.map((e) => {
        const [lo, hi] = DEFAULT_RULES.goals[e.goal].reps_range;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${e.name}`}
            onPress={() => onEditExercise(e)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[3],
              padding: space[3],
              backgroundColor: c.surfaceRaised,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
              <Txt kind="titleSm">{e.position}</Txt>
            </View>
            <View style={{ flex: 1, gap: space[1] }}>
              <Txt kind="strong">{e.name}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
                <GoalBadge goal={e.goal} label={GOAL_LABELS[e.goal]} />
                <Txt kind="caption" muted>
                  {plural(e.sets, "série", "séries")} · {lo}-{hi} reps · {EQUIPMENT_LABELS[e.equipment] ?? e.equipment}
                </Txt>
              </View>
            </View>
            <Icon name="next" color={c.ink} size={size.iconSm} />
          </Pressable>
        );
      })}
      <Button label="Ajouter un exercice" kind="secondary" onPress={onAddExercise} />
      <Button label="Supprimer la séance" kind="ghost" small onPress={() => act(() => repo.removeSession(session.id))} />
    </View>
  );
}

function ProgramSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [name, setName] = useState("");
  const [cycle, setCycle] = useState<CycleKind>("week");
  const [start, setStart] = useState(formatFr(todayIso()));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const startDate = parseFr(start);
    if (!startDate) return setError("Date de début : utilise le format JJ/MM/AAAA.");
    const ok = await act(() => repo.createProgram({ name, cycle, startDate }), setError);
    if (ok) {
      setName("");
      setError(null);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} title="Nouveau programme" onClose={onClose}>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Force 2026" />
      <View style={{ gap: space[1] }}>
        <Txt kind="caps" muted>Cycle</Txt>
        <Row>
          {(Object.keys(CYCLE_LABELS) as CycleKind[]).map((k) => (
            <Chip key={k} label={CYCLE_LABELS[k]} selected={k === cycle} onPress={() => setCycle(k)} />
          ))}
        </Row>
      </View>
      <Field label="Début (JJ/MM/AAAA)" value={start} onChangeText={(t) => setStart(maskFr(t))} placeholder="JJ/MM/AAAA" keyboardType="number-pad" />
      <ErrorText message={error} />
      <Button label="Créer le programme" onPress={submit} />
    </Sheet>
  );
}

function SessionSheet({
  visible,
  onClose,
  program,
  cycle,
}: {
  visible: boolean;
  onClose: () => void;
  program: number;
  cycle: CycleKind;
}) {
  const act = useAction();
  const { repo } = useStore();
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [dayText, setDayText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const chosen = cycle === "month" ? Number(dayText) : slot;
    if (chosen === null || Number.isNaN(chosen)) return setError("Choisis le jour de la séance.");
    const ok = await act(() => repo.addSession(program, { name, slot: chosen }), setError);
    if (ok) {
      setName("");
      setSlot(null);
      setDayText("");
      setError(null);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} title="Nouvelle séance" onClose={onClose}>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Séance A" />
      <View style={{ gap: space[1] }}>
        <Txt kind="caps" muted>Jour</Txt>
        {cycle === "month" ? (
          <Field label="Jour du mois (1 à 31)" value={dayText} onChangeText={setDayText} keyboardType="number-pad" />
        ) : (
          <Row>
            {Array.from({ length: slotCount(cycle) }, (_, i) => (
              <Chip
                key={i}
                label={cycle === "week" ? slotLabel(cycle, i) : `S${Math.floor(i / 7) + 1} ${slotLabel("week", i % 7).slice(0, 3)}`}
                selected={slot === i}
                onPress={() => setSlot(i)}
              />
            ))}
          </Row>
        )}
      </View>
      <ErrorText message={error} />
      <Button label="Ajouter la séance" onPress={submit} />
    </Sheet>
  );
}

function ExerciseSheet({ visible, onClose, sessionId }: { visible: boolean; onClose: () => void; sessionId: number }) {
  const act = useAction();
  const { repo } = useStore();
  const existing = useQuery((r) => r.listExercises()) ?? [];
  const [name, setName] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [sets, setSets] = useState("3");
  const [goal, setGoal] = useState<TrainingGoal>("strength");
  const [equipment, setEquipment] = useState("machine");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = Number(sets);
    const target = pickedId !== null ? { exerciseId: pickedId } : { name, equipment };
    const ok = await act(() => repo.addExercise(sessionId, { ...target, sets: n, goal }), setError);
    if (ok) {
      setName("");
      setPickedId(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} title="Ajouter un exercice" onClose={onClose}>
      {existing.length > 0 && (
        <View style={{ gap: space[1] }}>
          <Txt kind="caps" muted>Exercice existant</Txt>
          <Row>
            {existing.map((e) => (
              <Chip key={e.id} label={e.name} selected={pickedId === e.id} onPress={() => setPickedId(pickedId === e.id ? null : e.id)} />
            ))}
          </Row>
        </View>
      )}
      {pickedId === null && <Field label="Nouvel exercice" value={name} onChangeText={setName} placeholder="Tractions lestées" />}
      {pickedId === null && (
        <View style={{ gap: space[1] }}>
          <Txt kind="caps" muted>Matériel</Txt>
          <Row>
            {Object.keys(EQUIPMENT_LABELS).map((k) => (
              <Chip key={k} label={EQUIPMENT_LABELS[k]} selected={equipment === k} onPress={() => setEquipment(k)} />
            ))}
          </Row>
        </View>
      )}
      <Field label="Nombre de séries" value={sets} onChangeText={setSets} keyboardType="number-pad" />
      <View style={{ gap: space[1] }}>
        <Txt kind="caps" muted>Objectif</Txt>
        <Row>
          {(Object.keys(GOAL_LABELS) as TrainingGoal[]).map((g) => (
            <Chip key={g} label={GOAL_LABELS[g]} selected={goal === g} onPress={() => setGoal(g)} />
          ))}
        </Row>
      </View>
      <ErrorText message={error} />
      <Button label="Ajouter" onPress={submit} />
    </Sheet>
  );
}

function EditExerciseSheet({ exercise, onClose }: { exercise: SessionExercise | null; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = name ?? exercise?.name ?? "";

  const done = () => {
    setName(null);
    setError(null);
    onClose();
  };

  return (
    <Sheet visible={!!exercise} title="Modifier l'exercice" onClose={done}>
      <Field label="Nom" value={value} onChangeText={setName} />
      <Txt kind="caption" muted>Le nom change partout ; l'historique de l'exercice reste lié.</Txt>
      <ErrorText message={error} />
      <Button
        label="Enregistrer"
        onPress={async () => {
          if (exercise && (await act(() => repo.renameExercise(exercise.exerciseId, value), setError))) done();
        }}
      />
      <Button
        label="Retirer de la séance"
        kind="danger"
        onPress={async () => {
          if (exercise && (await act(() => repo.removeExercise(exercise.id), setError))) done();
        }}
      />
    </Sheet>
  );
}
