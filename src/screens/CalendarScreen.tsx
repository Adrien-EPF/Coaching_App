import React, { useState } from "react";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Pressable, Text, View } from "react-native";
import type { RootParams } from "../navigation";
import { useAction, useQuery, useStore } from "../data/RepoContext";
import { CalendarDay, CalendarItem } from "../data/repo";
import { addDays, daysInMonth, IsoDate, mondayOf, todayIso, toIso, weekday } from "../domain/dates";
import { formatFr, longDate, maskFr, MONTHS, parseFr, plural } from "../domain/format";
import { Icon, IconName } from "../ui/icons";
import { Button, Card, Chip, ErrorText, Field, IconButton, Row, Screen, SessionState, Sheet, Split, StatusBadge, Txt } from "../ui/kit";
import { fonts, radius, space, useColors } from "../ui/theme";

type Planned = Extract<CalendarItem, { type: "planned" }>;

const STATUS_LABELS: Record<Planned["status"], string> = {
  planned: "Prévue",
  done: "Faite",
  skipped: "Passée volontairement",
  missed: "Manquée",
  moved: "Déplacée",
};

const STATUS_STATE: Record<Planned["status"], SessionState> = {
  planned: "planned",
  done: "done",
  skipped: "notDone",
  missed: "missed",
  moved: "unplanned",
};

/** The letter a Session carries on the calendar: "Séance C" shows C. */
const initialOf = (name: string) => (name.trim().split(/\s+/).pop() ?? "?").slice(0, 1).toUpperCase();

export function CalendarScreen() {
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
  const c = useColors();

  return (
    <Screen
      title={`${MONTHS[month - 1].replace(/^./, (x) => x.toUpperCase())}${year === Number(today.slice(0, 4)) ? "" : ` ${year}`}`}
      lead={program ? program.name : "Aucun programme"}
      right={
        <View style={{ flexDirection: "row", marginRight: -space[3] }}>
          <IconButton icon="back" label="Mois précédent" onPress={() => shift(-1)} />
          <IconButton icon="next" label="Mois suivant" onPress={() => shift(1)} />
        </View>
      }
    >
      <View style={{ backgroundColor: c.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: space[2], gap: space[1] }}>
        <View style={{ flexDirection: "row" }}>
          {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => (
            <Txt key={i} kind="caps" muted style={{ flex: 1, textAlign: "center", paddingVertical: space[2] }}>{l}</Txt>
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

      <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
        <StatusBadge state="done" />
        <StatusBadge state="today" />
        <StatusBadge state="planned" />
        <StatusBadge state="missed" />
        <StatusBadge state="unplanned" />
      </View>

      <DayDetail date={selected} day={byDate.get(selected)} today={today} />
    </Screen>
  );
}

/** One mark on a calendar day: a letter on the Session's status color, with a glyph when it is done or missed. */
function Mark({ item, isToday }: { item: CalendarItem; isToday: boolean }) {
  const c = useColors();
  let bg = "transparent";
  let fg = c.ink;
  let border = c.lineStrong;
  let glyph: IconName | null = null;
  let letter = "+";
  if (item.type === "planned") {
    letter = initialOf(item.name);
    if (item.status === "done") ({ bg, fg, border, glyph } = { bg: c.limeSoft, fg: c.limeInk, border: c.limeSoft, glyph: "check" });
    else if (item.status === "missed") ({ bg, fg, border, glyph } = { bg: c.danger, fg: c.onDanger, border: c.danger, glyph: "cross" });
    else if (item.status === "planned" && isToday) ({ bg, fg, border } = { bg: c.lime, fg: c.onLime, border: c.lime });
    else if (item.status === "planned") ({ bg, fg, border } = { bg: "transparent", fg: c.ink, border: c.lineStrong });
    else ({ bg, fg, border } = { bg: c.surfaceSunken, fg: c.inkMuted, border: c.surfaceSunken });
  } else if (item.type === "rest") {
    ({ bg, fg, border, letter } = { bg: c.endurance, fg: c.onEndurance, border: c.endurance, letter: "R" });
  } else if (item.type === "injury") {
    ({ bg, fg, border, letter } = { bg: c.warning, fg: c.onWarning, border: c.warning, letter: "!" });
  } else {
    ({ bg, fg, border } = { bg: c.surfaceSunken, fg: c.ink, border: c.surfaceSunken });
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minWidth: 26,
        height: 22,
        paddingHorizontal: 4,
        borderRadius: radius.xs,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
      }}
    >
      {glyph ? <Icon name={glyph} color={fg} size={12} stroke={3} /> : null}
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 14, color: fg }}>{letter}</Text>
    </View>
  );
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
  const items = (day?.items ?? []).slice(0, 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={longDate(date)}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 64,
        borderRadius: radius.sm,
        borderWidth: 2,
        borderColor: isSelected ? c.contrast : "transparent",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: space[2],
        gap: space[1],
        opacity: inMonth ? 1 : 0.35,
      }}
    >
      <Txt kind="heading" style={{ fontSize: 20, lineHeight: 22 }}>{Number(date.slice(8))}</Txt>
      <View style={{ gap: 2 }}>
        {items.map((item, i) => (
          <Mark key={i} item={item} isToday={isToday} />
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
      {items.length === 0 && (
        <Card>
          <Txt kind="caps" muted>{longDate(date)}</Txt>
          <Txt muted>Rien de prévu ce jour-là.</Txt>
        </Card>
      )}
      {items.map((item, i) => (
        <ItemCard key={i} item={item} date={date} today={today} onMove={setMoving} />
      ))}
      <Split>
        <Button label="Hors programme" kind="secondary" icon="plus" small onPress={() => setUnplanned(true)} />
        <Button label="Repos ou blessure" kind="secondary" small onPress={() => setRest(true)} />
      </Split>
      <MoveSheet item={moving} date={date} today={today} onClose={() => setMoving(null)} />
      <UnplannedSheet visible={unplanned} date={date} onClose={() => setUnplanned(false)} />
      <RestSheet visible={rest} date={date} onClose={() => setRest(false)} />
    </View>
  );
}

function ItemCard({ item, date, today, onMove }: { item: CalendarItem; date: IsoDate; today: IsoDate; onMove: (i: Planned) => void }) {
  const act = useAction();
  const { repo } = useStore();
  const navigation = useNavigation<NavigationProp<RootParams>>();

  if (item.type !== "planned") {
    const title = item.type === "rest" ? "Repos" : item.type === "injury" ? "Blessure" : "Séance hors programme";
    return (
      <Card style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt kind="caps" muted>{longDate(date)}</Txt>
          {item.type === "unplanned" ? <StatusBadge state="unplanned" /> : null}
        </View>
        <Txt kind="titleLg">{title}</Txt>
        {item.label ? <Txt muted>{item.label}</Txt> : null}
        <Button label="Retirer" kind="secondary" small onPress={() => act(() => repo.removeEntry(item.id))} />
      </Card>
    );
  }

  const openLog = (programSessionId: number, on: IsoDate) => navigation.navigate("Log", { programSessionId, date: on });
  const movedIn = item.movedFrom !== undefined;
  const reset = () => act(() => repo.clearOccurrence(item.sessionId, item.plannedDate));
  const state: SessionState = item.status === "planned" && date === today ? "today" : STATUS_STATE[item.status];
  const detail =
    (item.movedTo ? `Déplacée au ${longDate(item.movedTo)}` : "") + (movedIn ? `Déplacée depuis le ${longDate(item.movedFrom!)}` : "");
  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
        <Txt kind="caps" muted>{longDate(date)}</Txt>
        <StatusBadge state={state} label={item.status === "skipped" ? "Passée" : item.status === "moved" ? "Déplacée" : undefined} />
      </View>
      <Txt kind="titleLg">{item.name}</Txt>
      <Txt muted>
        {plural(item.exerciseCount, "exercice", "exercices")} · {plural(item.setCount, "série", "séries")}
      </Txt>
      {detail ? <Txt kind="caption" muted>{detail}</Txt> : null}
      {item.status === "planned" && date <= today ? <Button large label="Commencer" onPress={() => openLog(item.sessionId, date)} /> : null}
      {item.status === "done" && <Button label="Voir la séance" kind="secondary" onPress={() => openLog(item.sessionId, date)} />}
      {item.status === "planned" || item.status === "missed" ? (
        <Split>
          {!movedIn ? <Button label="Déplacer" kind="secondary" small onPress={() => onMove(item)} /> : <View />}
          {!movedIn && item.status === "planned" ? <Button label="Passer" kind="secondary" small onPress={() => act(() => repo.skipSession(item.sessionId, date))} /> : <View />}
        </Split>
      ) : null}
      {!movedIn && item.status === "planned" && (
        <Button label="Marquer comme manquée" kind="ghost" small onPress={() => act(() => repo.markMissed(item.sessionId, date))} />
      )}
      {!movedIn && item.status !== "planned" && item.status !== "done" && (
        <Button label="Rétablir" kind="secondary" small onPress={reset} />
      )}
      {movedIn && <Button label="Annuler le déplacement" kind="secondary" small onPress={reset} />}
    </Card>
  );
}

function MoveSheet({ item, date, today, onClose }: { item: Planned | null; date: IsoDate; today: IsoDate; onClose: () => void }) {
  const act = useAction();
  const { repo } = useStore();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A week either side of the planned day, never before today and never the day itself.
  const options = Array.from({ length: 15 }, (_, i) => addDays(date, i - 7)).filter((d) => d !== date && d >= today);

  const move = async (to: IsoDate | null) => {
    if (!item) return;
    if (!to) return setError("Utilise le format JJ/MM/AAAA.");
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
          <Chip key={d} label={`${longDate(d).split(" ")[0].slice(0, 3)} ${formatFr(d).slice(0, 5)}`} onPress={() => move(d)} />
        ))}
      </Row>
      <Field label="Ou une autre date (JJ/MM/AAAA)" value={text} onChangeText={(t) => setText(maskFr(t))} placeholder="JJ/MM/AAAA" keyboardType="number-pad" />
      <ErrorText message={error} />
      <Button label="Déplacer" onPress={() => move(parseFr(text))} />
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
