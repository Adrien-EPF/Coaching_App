import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../data/RepoContext";
import { Icon, IconName, LogoMark } from "./icons";
import { Colors, fonts, radius, size, space, useColors, useIsDark } from "./theme";

type TextKind =
  | "hero"
  | "title"
  | "titleLg"
  | "heading"
  | "titleSm"
  | "caps"
  | "bodyLg"
  | "body"
  | "strong"
  | "caption";

const NUMS: TextStyle = { fontVariant: ["tabular-nums"] };

/** The design system's text styles: display face for what you read at arm's length, Barlow for sentences. */
const textStyles: Record<TextKind, TextStyle> = {
  hero: { fontFamily: fonts.display, fontSize: 72, lineHeight: 68, letterSpacing: -0.7, ...NUMS },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 48, textTransform: "uppercase" },
  titleLg: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 34, textTransform: "uppercase" },
  heading: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 28, ...NUMS },
  titleSm: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, ...NUMS },
  caps: { fontFamily: fonts.displayBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  bodyLg: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
};

export function Txt({
  kind = "body",
  muted,
  style,
  ...rest
}: React.ComponentProps<typeof Text> & { kind?: TextKind; muted?: boolean }) {
  const c = useColors();
  return <Text {...rest} style={[textStyles[kind], { color: muted ? c.inkMuted : c.ink }, style]} />;
}

/** Lifts its content above the keyboard, so the field being typed in stays visible. */
export function KeyboardView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

/** A round-cornered tap target holding one icon. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [{ width: size.tapMin, height: size.tapMin, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Icon name={icon} color={color ?? c.ink} size={size.iconMd} />
    </Pressable>
  );
}

/** A tab screen: scrolling content under a big title, on the app surface. */
export function Screen({
  title,
  subtitle,
  lead,
  children,
  right,
  onBack,
  left,
  brand,
}: {
  title: string;
  /** Overline above the title. */
  subtitle?: string;
  /** Muted line under the title. */
  lead?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  /** Shows a back arrow before the title. */
  onBack?: () => void;
  left?: React.ReactNode;
  /** Puts the logo lockup in a top bar, with `right` at its end. */
  brand?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { changed } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);
  // Pull down to reload: every screen re-reads its data after a write, and this is a write-free nudge.
  const refresh = () => {
    setRefreshing(true);
    changed();
    setTimeout(() => setRefreshing(false), 600);
  };
  return (
    <KeyboardView style={{ backgroundColor: c.surface }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.ink} colors={[c.ink]} progressBackgroundColor={c.surfaceRaised} />}
        style={{ flex: 1, backgroundColor: c.surface }}
        contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[2], paddingBottom: space[8], gap: space[5] }}
        keyboardShouldPersistTaps="handled"
      >
        {brand ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <LogoMark color={c.ink} size={36} />
              <Text style={{ fontFamily: fonts.display, fontSize: 24, letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>Coaching App</Text>
            </View>
            {right}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space[2] }}>
          {onBack ? <IconButton icon="back" label="Retour" onPress={onBack} style={{ marginLeft: -space[3] }} /> : null}
          <View style={{ flex: 1, gap: space[1], paddingTop: space[2] }}>
            {left}
            {subtitle ? <Txt kind="caps" muted>{subtitle}</Txt> : null}
            <Txt kind="title">{title}</Txt>
            {lead ? <Txt muted>{lead}</Txt> : null}
          </View>
          {brand ? null : right}
        </View>
        {children}
      </ScrollView>
    </KeyboardView>
  );
}

/** Overline above a group of cards. */
export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[3] }}>
      <Txt kind="caps" muted>{children}</Txt>
      {right}
    </View>
  );
}

/** Cards are raised surfaces with a 1px line border: borders, not shadows. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        { backgroundColor: c.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: space[4], gap: space[2] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A card of rows separated by 1px lines; the header sits on its own row. */
export function ListCard({ header, aside, children }: { header?: string; aside?: string; children: React.ReactNode }) {
  const c = useColors();
  const rows = React.Children.toArray(children);
  return (
    <View style={{ backgroundColor: c.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}>
      {header ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[3], padding: space[4] }}>
          <Txt kind="caps" muted>{header}</Txt>
          {aside ? <Txt kind="caption" muted>{aside}</Txt> : null}
        </View>
      ) : null}
      {rows.map((row, i) => (
        <View key={i} style={{ borderTopWidth: header || i > 0 ? 1 : 0, borderTopColor: c.line }}>
          {row}
        </View>
      ))}
    </View>
  );
}

/** The inverted slab: Gemini's session line, the session header. */
export function Slab({ overline, children }: { overline?: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.contrast, borderRadius: radius.lg, padding: space[4], gap: space[2] }}>
      {overline ? <Txt kind="caps" style={{ color: c.onContrast }}>{overline}</Txt> : null}
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  small,
  large,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  /** Compact, inside a card. Still at least the tap minimum high. */
  small?: boolean;
  /** The screen's main action: 56px high. */
  large?: boolean;
  icon?: IconName;
}) {
  const c = useColors();
  const bg = kind === "primary" ? c.lime : kind === "danger" ? c.danger : "transparent";
  const fg = kind === "primary" ? c.onLime : kind === "danger" ? c.onDanger : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        borderWidth: kind === "secondary" ? 1.5 : 0,
        borderColor: c.lineStrong,
        minHeight: large ? size.controlLg : size.tapMin,
        paddingHorizontal: space[4],
        flexDirection: "row",
        gap: space[2],
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        overflow: "hidden",
      })}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.ink, opacity: 0.12 }} /> : null}
          {icon ? <Icon name={icon} color={fg} size={size.iconSm} /> : null}
          <Text
            style={{
              fontFamily: fonts.displayBold,
              fontSize: small ? 15 : 18,
              letterSpacing: small ? 0.8 : 1,
              textTransform: "uppercase",
              color: fg,
              flexShrink: 1,
              textAlign: "center",
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: "danger";
  icon?: IconName;
}) {
  const c = useColors();
  const fg = selected ? c.onContrast : tone === "danger" ? c.dangerInk : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: size.tapMin,
        paddingHorizontal: space[4],
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? c.contrast : c.lineStrong,
        backgroundColor: selected ? c.contrast : c.surfaceRaised,
        flexDirection: "row",
        gap: space[2],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon ? <Icon name={icon} color={fg} size={size.iconSm} /> : null}
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: 0.8, textTransform: "uppercase", color: fg }}>{label}</Text>
    </Pressable>
  );
}

const goalColors = (c: Colors) => ({
  strength: { bg: c.strength, fg: c.onStrength },
  hypertrophy: { bg: c.hypertrophy, fg: c.onHypertrophy },
  endurance: { bg: c.endurance, fg: c.onEndurance },
});

/** The Training Goal of an Exercise: its color always comes with its label. */
export function GoalBadge({ goal, label }: { goal: "strength" | "hypertrophy" | "endurance"; label: string }) {
  const c = useColors();
  const { bg, fg } = goalColors(c)[goal];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: space[1] }}>
      <Txt kind="caps" style={{ color: fg }}>{label}</Txt>
    </View>
  );
}

export type SessionState = "planned" | "today" | "done" | "missed" | "unplanned" | "notDone";

const STATE_LABELS: Record<SessionState, string> = {
  planned: "Prévue",
  today: "Aujourd'hui",
  done: "Validée",
  missed: "Manquée",
  unplanned: "Hors programme",
  notDone: "Non effectuée",
};

/** Where a Session stands: always a word and a glyph, never color alone. */
export function StatusBadge({ state, label }: { state: SessionState; label?: string }) {
  const c = useColors();
  const look = {
    planned: { bg: "transparent", fg: c.ink, border: c.lineStrong, icon: "circle" as IconName },
    today: { bg: c.lime, fg: c.onLime, border: c.lime, icon: "dot" as IconName },
    done: { bg: c.limeSoft, fg: c.limeInk, border: c.limeSoft, icon: "check" as IconName },
    missed: { bg: c.danger, fg: c.onDanger, border: c.danger, icon: "cross" as IconName },
    unplanned: { bg: c.surfaceSunken, fg: c.ink, border: c.surfaceSunken, icon: "plus" as IconName },
    notDone: { bg: c.surfaceSunken, fg: c.inkMuted, border: c.surfaceSunken, icon: "cross" as IconName },
  }[state];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
        backgroundColor: look.bg,
        borderColor: look.border,
        borderWidth: 1.5,
        borderRadius: radius.sm,
        paddingHorizontal: space[2],
        paddingVertical: 2,
      }}
    >
      <Icon name={look.icon} color={look.fg} size={16} stroke={2.4} />
      <Txt kind="caps" style={{ color: look.fg }}>{label ?? STATE_LABELS[state]}</Txt>
    </View>
  );
}

export function Field({ label, style, big, ...rest }: TextInputProps & { label: string; big?: boolean }) {
  const c = useColors();
  return (
    <View style={{ gap: space[1] }}>
      <Txt kind="caps" muted>{label}</Txt>
      <TextInput
        placeholderTextColor={c.inkSubtle}
        selectionColor={c.focus}
        {...rest}
        style={[
          {
            fontFamily: big ? fonts.display : fonts.sansMedium,
            fontSize: big ? 28 : 17,
            color: c.ink,
            backgroundColor: c.surfaceRaised,
            borderWidth: 1.5,
            borderColor: c.lineStrong,
            borderRadius: radius.md,
            paddingHorizontal: space[3],
            minHeight: big ? size.controlLg : size.tapMin,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Row({ children, wrap = true }: { children: React.ReactNode; wrap?: boolean }) {
  return <View style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", gap: space[2] }}>{children}</View>;
}

/** Splits a row evenly between its buttons. */
export function Split({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: space[2] }}>
      {React.Children.toArray(children).map((child, i) => (
        <View key={i} style={{ flex: 1 }}>{child}</View>
      ))}
    </View>
  );
}

/** A bottom sheet over a scrim, with a grabber and a close button. */
export function Sheet({
  visible,
  title,
  overline,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  /** Small caps line above the title. */
  overline?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardView>
        <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} accessibilityLabel="Fermer" />
        <View
          style={{
            backgroundColor: c.surfaceRaised,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: "88%",
            elevation: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: dark ? 0.5 : 0.12,
            shadowRadius: 24,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: space[2] }}>
            <View style={{ width: 40, height: 4, borderRadius: radius.xs, backgroundColor: c.lineStrong }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[4], gap: space[4] }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space[2] }}>
              <View style={{ flex: 1, gap: space[1] }}>
                {overline ? <Txt kind="caps" muted>{overline}</Txt> : null}
                <Txt kind="titleLg">{title}</Txt>
              </View>
              <IconButton icon="close" label="Fermer" onPress={onClose} style={{ marginRight: -space[3], marginTop: -space[2] }} />
            </View>
            {children}
          </ScrollView>
        </View>
      </KeyboardView>
    </Modal>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const c = useColors();
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: c.dangerInk }}>
      {message}
    </Text>
  );
}

/** A thin bar filled to `pct` percent. `onContrast` for use on the inverted slab. */
export function ProgressBar({ pct, onContrast }: { pct: number; onContrast?: boolean }) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height: 8, borderRadius: radius.xs, backgroundColor: onContrast ? c.contrastTrack : c.surfaceSunken, overflow: "hidden" }}>
      <View style={{ height: 8, borderRadius: radius.xs, backgroundColor: onContrast ? c.contrastFill : c.contrast, width: `${clamped}%` }} />
    </View>
  );
}

/** A numeric value between two big buttons: weight and reps in the Set sheet. */
export function Stepper({
  value,
  onChange,
  onMinus,
  onPlus,
  keyboardType = "decimal-pad",
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  keyboardType?: TextInputProps["keyboardType"];
  placeholder?: string;
}) {
  const c = useColors();
  const step = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size.controlLg,
        height: size.controlLg,
        borderRadius: radius.md,
        backgroundColor: c.surfaceSunken,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} color={c.ink} size={size.iconMd} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: space[2] }}>
      {step("minus", "Moins", onMinus)}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.inkSubtle}
        selectionColor={c.focus}
        textAlign="center"
        style={{
          flex: 1,
          height: size.controlLg,
          fontFamily: fonts.display,
          fontSize: 32,
          color: c.ink,
          backgroundColor: c.surfaceRaised,
          borderWidth: 2,
          borderColor: c.contrast,
          borderRadius: radius.md,
          paddingVertical: 0,
          ...NUMS,
        }}
      />
      {step("plus", "Plus", onPlus)}
    </View>
  );
}

/** The RPE scale: the selected step is inverted, steps above `maxToClimb` carry a warning underline. */
export function RpePicker({
  value,
  onChange,
  maxToClimb,
  steps,
  meaning,
}: {
  value: number | null;
  onChange: (rpe: number) => void;
  maxToClimb?: number | null;
  steps: number[];
  meaning?: string | null;
}) {
  const c = useColors();
  const lowest = steps[0];
  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Txt kind="caps" muted>RPE</Txt>
        {maxToClimb != null ? <Txt kind="caption" muted>Max pour monter : {String(maxToClimb).replace(".", ",")}</Txt> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {steps.map((v) => {
          const selected = value !== null && (v === lowest ? value <= lowest : value === v);
          const risky = maxToClimb != null && v > maxToClimb;
          return (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(v)}
              style={{
                flex: 1,
                height: size.controlLg,
                borderRadius: radius.sm,
                backgroundColor: selected ? c.contrast : c.surfaceSunken,
                borderBottomWidth: risky ? 4 : 0,
                borderBottomColor: c.warning,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.displayBold,
                  fontSize: 20,
                  color: selected ? c.onContrast : risky ? c.warningInk : c.ink,
                  ...NUMS,
                }}
              >
                {v === lowest ? `≤${v}` : String(v).replace(".", ",")}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {meaning ? <Txt kind="strong">{meaning}</Txt> : null}
    </Card>
  );
}

/** Gemini's "why this weight", with an optional Guardrail flag. */
export function RecommendationNote({ text, delta, flag }: { text: string; delta?: string; flag?: string }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: space[3], gap: space[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
        <Txt kind="caps" muted>Pourquoi cette charge</Txt>
        {delta ? <DeltaPill text={delta} /> : null}
      </View>
      <Txt kind="bodyLg">{text}</Txt>
      {flag ? (
        <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: space[1], backgroundColor: c.warning, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 2 }}>
          <Icon name="shield" color={c.onWarning} size={16} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: c.onWarning, flexShrink: 1 }}>{flag}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** "↑ +6 kg" on lime, "↓ −2 kg" on danger. */
function DeltaPill({ text }: { text: string }) {
  const c = useColors();
  const down = text.startsWith("−") || text.startsWith("-");
  const bg = down ? c.danger : c.lime;
  const fg = down ? c.onDanger : c.onLime;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: space[2], paddingVertical: 2 }}>
      <Icon name={down ? "down" : "up"} color={fg} size={16} stroke={2.4} />
      <Txt kind="caps" style={{ color: fg }}>{text}</Txt>
    </View>
  );
}
