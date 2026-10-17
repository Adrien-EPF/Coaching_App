import React, { useEffect, useState } from "react";
import { useAction, useStore } from "../data/RepoContext";
import type { IsoDate } from "../domain/dates";
import { longDate } from "../domain/format";
import { Button, ErrorText, Field, Row, Sheet, Txt, Chip } from "../ui/kit";

export const PROBLEM_KINDS = ["Mauvais sommeil", "Douleur", "Fatigue", "Malade", "Stress", "Autre"];

/** Signaler un problème on an upcoming Session: re-plans it with the note. */
export function ProblemSheet({
  target,
  onClose,
}: {
  target: { programSessionId: number; name: string; date: IsoDate } | null;
  onClose: () => void;
}) {
  const { repo } = useStore();
  const act = useAction();
  const [kinds, setKinds] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setKinds([]);
    setDetails("");
    setError(null);
  }, [target]);

  if (!target) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;

  const toggle = (k: string) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const submit = async () => {
    setBusy(true);
    const ok = await act(() => repo.reportProblem(target.programSessionId, target.date, { kinds, details }), setError);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet visible title="Signaler un problème" onClose={onClose}>
      <Txt muted>
        {target.name} · {longDate(target.date)}. Le plan de cette séance sera recalculé avec ta note.
      </Txt>
      <Txt kind="caps" muted>Ce qui ne va pas</Txt>
      <Row>
        {PROBLEM_KINDS.map((k) => (
          <Chip key={k} label={k} selected={kinds.includes(k)} onPress={() => toggle(k)} />
        ))}
      </Row>
      <Field label="Précisions" value={details} onChangeText={setDetails} multiline placeholder="5 h de sommeil. Épaule droite un peu raide." style={{ minHeight: 96, textAlignVertical: "top", paddingTop: 12 }} />
      <Txt kind="caption" muted>Avec un problème signalé, Gemini peut garder ou baisser les charges, jamais les monter.</Txt>
      <ErrorText message={error} />
      <Button label={busy ? "Replanification…" : "Replanifier la séance"} disabled={busy} onPress={submit} />
      <Button label="Annuler" kind="secondary" onPress={onClose} />
    </Sheet>
  );
}
