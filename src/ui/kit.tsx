import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
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
import { fonts, radius, space, useColors } from "./theme";

type TextKind = "title" | "heading" | "body" | "strong" | "caption" | "caps";

const textStyles: Record<TextKind, TextStyle> = {
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, textTransform: "uppercase" },
  heading: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 28 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  strong: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 17 },
  caps: { fontFamily: fonts.sansBold, fontSize: 13, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
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

/** A tab screen: scrolling content under a big title, on the app surface. */
export function Screen({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardView style={{ backgroundColor: c.surface }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: space[4], paddingTop: insets.top + space[4], gap: space[5] }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Txt kind="caps" muted>{subtitle}</Txt> : null}
          <Txt kind="title">{title}</Txt>
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
    </KeyboardView>
  );
}

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

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  small?: boolean;
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
        minHeight: small ? 40 : 52,
        paddingHorizontal: space[4],
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.sansBold, fontSize: small ? 14 : 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: "danger";
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: space[3],
        borderRadius: radius.sm,
        borderWidth: 1.5,
        borderColor: selected ? c.contrast : c.lineStrong,
        backgroundColor: selected ? c.contrast : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.sansSemi,
          fontSize: 14,
          color: selected ? c.onContrast : tone === "danger" ? c.danger : c.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space[1] }}>
      <Txt kind="caps" muted>{label}</Txt>
      <TextInput
        placeholderTextColor={c.inkSubtle}
        {...rest}
        style={[
          {
            fontFamily: fonts.sansMedium,
            fontSize: 17,
            color: c.ink,
            backgroundColor: c.surfaceRaised,
            borderWidth: 1.5,
            borderColor: c.lineStrong,
            borderRadius: radius.sm,
            paddingHorizontal: space[3],
            minHeight: 48,
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

/** A bottom sheet over a scrim. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardView>
      <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} accessibilityLabel="Fermer" />
      <View
        style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          maxHeight: "85%",
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[4], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <Txt kind="heading">{title}</Txt>
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
    <Text accessibilityRole="alert" style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: c.danger }}>
      {message}
    </Text>
  );
}

/** A thin lime bar filled to `pct` percent. */
export function ProgressBar({ pct }: { pct: number }) {
  const c = useColors();
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.line }}>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.lime, width: `${pct}%` }} />
    </View>
  );
}
