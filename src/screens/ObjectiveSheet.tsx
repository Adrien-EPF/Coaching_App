import React, { useEffect, useState } from "react";
import { maskFr, parseFr } from "../domain/format";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { Button, Chip, ErrorText, Field, Row, Sheet, Txt } from "../ui/kit";

const toNumber = (text: string) => Number(text.trim().replace(",", "."));

/** Sets an Objective: a target PR (reps at a weight) on an Exercise, by a date. */
export function ObjectiveSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { repo } = useStore();
  const act = useAction();
  const exercises = useQuery((r) => r.listExercises());
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [byDate, setByDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setExerciseId(null);
    setReps("");
    setWeight("");
    setByDate("");
    setError(null);
  }, [visible]);

  const submit = async () => {
    if (exerciseId === null) return setError("Choisis un exercice.");
    const date = parseFr(byDate);
    if (!date) return setError("La date doit être au format JJ/MM/AAAA.");
    const ok = await act(() => repo.addObjective({ exerciseId, reps: toNumber(reps), weight: toNumber(weight), byDate: date }), setError);
    if (ok) onClose();
  };

  return (
    <Sheet visible={visible} title="Nouvel objectif" onClose={onClose}>
      <Txt kind="caps" muted>Exercice</Txt>
      <Row>
        {(exercises ?? []).map((e) => (
          <Chip key={e.id} label={e.name} selected={exerciseId === e.id} onPress={() => setExerciseId(e.id)} />
        ))}
      </Row>
      <Field label="Reps visées" value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="5" />
      <Field label="Charge visée (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="10" />
      <Field label="D'ici le (JJ/MM/AAAA)" value={byDate} onChangeText={(t) => setByDate(maskFr(t))} placeholder="01/03/2027" keyboardType="number-pad" />
      <Txt kind="caption" muted>Gemini en tient compte comme contexte, sans jamais dépasser tes garde-fous.</Txt>
      <ErrorText message={error} />
      <Button label="Ajouter l'objectif" onPress={submit} />
      <Button label="Annuler" kind="secondary" onPress={onClose} />
    </Sheet>
  );
}
