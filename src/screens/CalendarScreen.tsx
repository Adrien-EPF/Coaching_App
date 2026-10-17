import React, { useState } from "react";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Pressable, View } from "react-native";
import type { RootParams } from "../navigation";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { CalendarDay, CalendarItem } from "../data/repo";
import { addDays, daysInMonth, IsoDate, mondayOf, todayIso, toIso, weekday } from "../domain/dates";
import { isIsoDate, longDate, MONTHS, plural } from "../domain/format";
import { Button, Card, Chip, ErrorText, Field, Row, Screen, Sheet, Txt } from "../ui/kit";
import { fonts, radius, space, useColors } from "../ui/theme";

type Planned = Extract<CalendarItem, { type: "planned" }>;

const STATUS_LABELS: Record<Planned["status"], string> = {
  planned: "Prévue",
  done: "Faite",
  skipped: "Passée volontairement",
  missed: "Manquée",
  moved: "Déplacée",
};

export function CalendarScreen() {
  const c = useColors();
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<IsoDate>(today);

  const first = toIso(new Date(Date.UTC(year, month - 1, 1)));
  const gridStart = mondayOf(first);
  const last = toIso(new Date(Date.UTC(year, month - 1, daysInMonth(year, month))));
  const gridEnd = addDays(mondayOf(last), 6);
  const days = useQuery((repo) => repo.getCalendar(gridStart, gridEnd, today), [gridStart, gridEnd, today]);
  const program = useQuery((repo) => repo.getActiveProgram());

  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const weeks: IsoDate[][] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));

  const shift = (delta: number) => {
    const m = month - 1 + delta;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12 + 1);
  };

  return (
    <Screen title="Calendrier" subtitle={program ? program.name : "Aucun programme"}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Chip label="‹" onPress={() => shift(-1)} />
        <Txt kind="heading">{MONTHS[month - 1].replace(/^./, (x) => x.toUpperCase())} {year}</Txt>
        <Chip label="›" onPress={() => shift(1)} />
      </View>

      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row" }}>
          {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
            <Txt key={i} kind="caps" muted style={{ flex: 1, textAlign: "center" }}>{l}</Txt>
          ))}
        </View>
        {weeks.map((w) => (
          <View key={w[0]} style={{ flexDirection: "row", gap: space[1] }}>
            {w.map((date) => (
              <DayCell
                key={date}
                date={date}
                day={byDate.get(date)}
                inMonth={Number(date.slice(5, 7)) === month}
                isToday={date === today}
                isSelected={date === selected}
                onPress={() => setSelected(date)}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: space[4], flexWrap: "wrap" }}>
        <Legend color={c.lime} label="Prévue" />
        <Legend color={c.danger} label="Manquée" />
        <Legend color={c.lineStrong} label="Passée / déplacée" />
        <Legend color={c.enduranceInk} label="Repos" />
        <Legend color={c.warningInk} label="Blessure" />
      </View>

      <DayDetail date={selected} day={byDate.get(selected)} today={today} />
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
      <View style={{ width: 12, height: 6, borderRadius: radius.xs, backgroundColor: color }} />
      <Txt kind="caption" muted>{label}</Txt>
    </View>
  );
}

function marksOf(items: CalendarItem[], c: ReturnType<typeof useColors>): string[] {
  return items.map((i) => {
    if (i.type !== "planned") return i.type === "rest" ? c.enduranceInk : i.type === "injury" ? c.warningInk : c.ink;
    return i.status === "planned" || i.status === "done" ? c.lime : i.status === "missed" ? c.danger : c.lineStrong;
  });
}

function DayCell({
  date,
  day,
  inMonth,
  isToday,
  isSelected,
  onPress,
}: {
  date: IsoDate;
  day?: CalendarDay;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const marks = marksOf(day?.items ?? [], c);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={longDate(date)}
      onPress={onPress}
      style={{
        flex: 1,
        height: 56,
        borderRadius: radius.sm,
        alignItems: "center",
        justifyContent: "center",
        gap: space[1],
        backgroundColor: isSelected ? c.contrast : isToday ? c.limeSoft : "transparent",
        opacity: inMonth ? 1 : 0.4,
      }}
    >
      <Txt style={{ fontFamily: fonts.sansBold, color: isSelected ? c.onContrast : c.ink }}>{Number(date.slice(8))}</Txt>
      <View style={{ flexDirection: "row", gap: 2, height: 6 }}>
        {marks.slice(0, 3).map((color, i) => (
          <View key={i} style={{ width: 12, height: 6, borderRadius: radius.xs, backgroundColor: color }} />
        ))}
      </View>
    </Pressable>
  );
}

function DayDetail({ date, day, today }: { date: IsoDate; day?: CalendarDay; today: IsoDate }) {
  const [moving, setMoving] = useState<Planned | null>(null);
  const [unplanned, setUnplanned] = useState(false);
  const [rest, setRest] = useState(false);
  const items = day?.items ?? [];

  return (
    <View style={{ gap: space[3] }}>
      <Txt kind="heading">{longDate(date)}</Txt>
      {items.length === 0 && <Txt muted>Rien de prévu ce jour-là.</Txt>}
      {items.map((item, i) => (
        <ItemCard key={i} item={item} date={date} onMove={setMoving} />
      ))}
      <Row>
        <Button label="Hors programme" kind="secondary" small onPress={() => setUnplanned(true)} />
        <Button label="Repos ou blessure" kind="secondary" small onPress={() => setRest(true)} />
      </Row>
      <MoveSheet item={moving} date={date} today={today} onClose={() => setMoving(null)} />
      <UnplannedSheet visible={unplanned} date={date} onClose={() => setUnplanned(false)} />
      <RestSheet visible={rest} date={date} onClose={() => setRest(false)} />
    </View>
  );
}

function ItemCard({ item, date, onMove }: { item: CalendarItem; date: IsoDate; onMove: (i: Planned) => void }) {
  const act = useAction();
  const { repo } = useStore();
  const c = useColors();

  if (item.type !== "planned") {
    const title = item.type === "rest" ? "Repos" : item.type === "injury" ? "Blessure" : "Séance hors programme";
    return (
      <Card>
        <Txt kind="strong">{title}</Txt>
        {item.label ? <Txt muted>{item.label}</Txt> : null}
        <Row>
          <Button label="Retirer" kind="secondary" small onPress={() => act(() => repo.removeEntry(item.id))} />
        </Row>
      </Card>
    );
  }

  const navigation = useNavigation<NavigationProp<RootParams>>();
  const openLog = (programSessionId: number, on: IsoDate) => navigation.navigate("Log", { programSessionId, date: on });
  const movedIn = item.movedFrom !== undefined;
  const reset = () => act(() => repo.clearOccurrence(item.sessionId, item.plannedDate));
  const color = item.status === "missed" ? c.danger : item.status === "planned" || item.status === "done" ? c.limeInk : c.inkMuted;
  return (
    <Card>
      <Txt kind="strong">{item.name}</Txt>
      <Txt muted>
        {plural(item.exerciseCount, "exercice", "exercices")} · {plural(item.setCount, "série", "séries")}
      </Txt>
      <Txt kind="caps" style={{ color }}>
        {STATUS_LABELS[item.status]}
        {item.movedTo ? ` au ${longDate(item.movedTo)}` : ""}
        {movedIn ? ` · depuis le ${longDate(item.movedFrom!)}` : ""}
      </Txt>
      <Row>
        {item.status === "planned" || item.status === "missed" ? (
          <>
            {!movedIn && <Button label="Déplacer" kind="secondary" small onPress={() => onMove(item)} />}
            {!movedIn && item.status === "planned" && (
              <Button label="Passer" kind="secondary" small onPress={() => act(() => repo.skipSession(item.sessionId, date))} />
            )}
            {!movedIn && item.status === "planned" && (
              <Button label="Marquer comme manquée" kind="secondary" small onPress={() => act(() => repo.markMissed(item.sessionId, date))} />
            )}
          </>
        ) : null}
        {item.status === "done" && (
          <Button label="Voir la séance" kind="secondary" small onPress={() => openLog(item.sessionId, date)} />
        )}
        {item.status === "planned" && date <= todayIso() && (
          <Button label="Commencer" small onPress={() => openLog(item.sessionId, date)} />
        )}
        {!movedIn && item.status !== "planned" && item.status !== "done" && (
          <Button label="Rétablir" kind="secondary" small onPress={reset} />
        )}
        {movedIn && <Button label="Annuler le déplacement" kind="secondary" small onPress={reset} />}
      </Row>
    </Card>
  );
}

function MoveSheet({ item, date, today, onClose }: { item: Planned | null; date: IsoDate; today: IsoDate; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const options = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1));

  const move = async (to: string) => {
    if (!item) return;
    if (!isIsoDate(to)) return setError("Utilise le format AAAA-MM-JJ.");
    if (to < today) return setError("Choisis un jour qui n'est pas déjà passé.");
    if (await act(() => repo.moveSession(item.sessionId, date, to), setError)) {
      setText("");
      setError(null);
      onClose();
    }
  };

  return (
    <Sheet visible={!!item} title="Déplacer la séance" onClose={onClose}>
      <Txt muted>{item?.name} · le programme ne change pas, seul ce jour est déplacé.</Txt>
      <Row>
        {options.map((d) => (
          <Chip key={d} label={`${longDate(d).split(" ")[0].slice(0, 3)} ${Number(d.slice(8))}`} onPress={() => move(d)} />
        ))}
      </Row>
      <Field label="Ou une autre date (AAAA-MM-JJ)" value={text} onChangeText={setText} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <ErrorText message={error} />
      <Button label="Déplacer" onPress={() => move(text)} />
    </Sheet>
  );
}

function UnplannedSheet({ visible, date, onClose }: { visible: boolean; date: IsoDate; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible={visible} title="Séance hors programme" onClose={onClose}>
      <Field label="Nom" value={label} onChangeText={setLabel} placeholder="Séance libre" />
      <ErrorText message={error} />
      <Button
        label="Ajouter"
        onPress={async () => {
          if (await act(() => repo.addUnplanned(date, label), setError)) {
            setLabel("");
            onClose();
          }
        }}
      />
    </Sheet>
  );
}

function RestSheet({ visible, date, onClose }: { visible: boolean; date: IsoDate; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setNote("");
    onClose();
  };
  return (
    <Sheet visible={visible} title="Repos ou blessure" onClose={onClose}>
      <Txt muted>La séance prévue ce jour-là est passée ; le reste du programme ne bouge pas.</Txt>
      <Button label="Jour de repos" onPress={async () => (await act(() => repo.markRest(date), setError)) && done()} />
      <Field label="Blessure (précision facultative)" value={note} onChangeText={setNote} placeholder="Épaule droite" />
      <ErrorText message={error} />
      <Button label="Signaler une blessure" kind="secondary" onPress={async () => (await act(() => repo.markInjury(date, note), setError)) && done()} />
    </Sheet>
  );
}
