import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { longDate } from "../domain/format";
import type { RootParams } from "../navigation";
import { Button, CardioBadge, Chip, ErrorText, Field, Row, RpePicker, Screen, Stepper, Txt } from "../ui/kit";
import { space } from "../ui/theme";
import { rpeMeaning, RPE_STEPS } from "./LogScreen";

const parseNumber = (text: string) => Number(text.trim().replace(",", "."));
const num = (n: number) => String(n).replace(".", ",");

/** Entering a cardio Session in one go: planned (the sport comes from the Program), logged already, or Unplanned. */
export function CardioScreen() {
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const { params } = useRoute<RouteProp<RootParams, "Cardio">>();
  const { repo } = useStore();
  const act = useAction();
  const sports = useQuery((r) => r.listSports()) ?? [];
  const planned = useQuery(async (r) => {
    if (params.programSessionId === undefined) return null;
    const detail = await r.getActiveProgram().then((p) => p && r.getProgramDetail(p.id));
    return detail?.sessions.find((s) => s.id === params.programSessionId) ?? null;
  }, [params.programSessionId]);
  const existing = useQuery(async (r) => {
    if (params.logId !== undefined) return r.getCardio(params.logId);
    return params.programSessionId === undefined ? undefined : r.findCardio(params.programSessionId, params.date);
  }, [params.logId, params.programSessionId, params.date]);

  const [sport, setSport] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [distance, setDistance] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || (existing === undefined && planned === undefined)) return;
    // Once only: a later refresh must not overwrite what is being typed.
    filled.current = true;
    // Pre-fill: what is logged, else the sport planned in the Program.
    setSport(existing?.sport ?? planned?.sport ?? "");
    setDuration(existing ? num(existing.durationMin) : "");
    setRpe(existing?.rpe ?? null);
    setNote(existing?.note ?? "");
    setDistance(existing?.distanceKm == null ? "" : num(existing.distanceKm));
    setHeartRate(existing?.avgHr == null ? "" : String(existing.avgHr));
  }, [existing, planned]);

  const date = existing?.date ?? params.date;
  const save = async () => {
    if (rpe === null) return setError("Choisis le RPE.");
    const ok = await act(
      () =>
        repo.logCardio({
          programSessionId: existing ? existing.programSessionId : (params.programSessionId ?? null),
          date,
          sport,
          durationMin: parseNumber(duration),
          rpe,
          note,
          ...(distance.trim() ? { distanceKm: parseNumber(distance) } : {}),
          ...(heartRate.trim() ? { avgHr: parseNumber(heartRate) } : {}),
        }),
      setError,
    );
    if (ok) navigation.goBack();
  };

  const stepDuration = (delta: number) => {
    const n = parseNumber(duration);
    setDuration(num(Math.max(0, (Number.isNaN(n) ? 0 : n) + delta)));
  };

  return (
    <Screen title={existing ? "Séance de cardio" : "Nouveau cardio"} subtitle={longDate(date)} onBack={() => navigation.goBack()} left={<CardioBadge />}>
      <View style={{ gap: space[2] }}>
        <Txt kind="caps" muted>Sport</Txt>
        <Row>
          {sports.map((s) => (
            <Chip key={s} label={s} selected={sport.trim().toLowerCase() === s.toLowerCase()} onPress={() => setSport(s)} />
          ))}
        </Row>
        <Field label="Ou un autre sport" value={sport} onChangeText={setSport} placeholder="Padel" />
      </View>
      <View style={{ gap: space[2] }}>
        <Txt kind="caps" muted>Durée (minutes)</Txt>
        <Stepper value={duration} onChange={setDuration} onMinus={() => stepDuration(-5)} onPlus={() => stepDuration(5)} />
      </View>
      <RpePicker value={rpe} onChange={setRpe} steps={RPE_STEPS} meaning={rpe !== null ? rpeMeaning(rpe) : null} />
      <Field label="Distance en km (facultatif)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
      <Field label="Fréquence cardiaque moyenne (facultatif)" value={heartRate} onChangeText={setHeartRate} keyboardType="number-pad" />
      <Field label="Note (facultatif)" value={note} onChangeText={setNote} multiline />
      <ErrorText message={error} />
      <Button large label="Enregistrer" onPress={save} />
      {existing ? (
        <Button
          label="Supprimer la séance"
          kind="danger"
          onPress={async () => {
            if (await act(() => repo.removeCardio(existing.logId), setError)) navigation.goBack();
          }}
        />
      ) : null}
    </Screen>
  );
}
