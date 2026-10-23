import React from "react";
import Svg, { G, Path, Polyline, Rect, Circle } from "react-native-svg";

export type IconName =
  | "session"
  | "calendar"
  | "list"
  | "trend"
  | "sliders"
  | "back"
  | "next"
  | "chevron-down"
  | "close"
  | "plus"
  | "minus"
  | "check"
  | "cross"
  | "alert"
  | "shield"
  | "circle"
  | "dot"
  | "up"
  | "down"
  | "more";

/** The 2px-stroke outline set from the design system (Lucide-style), drawn on a 24px grid. */
export function Icon({ name, color, size = 20, stroke = 2 }: { name: IconName; color: string; size?: number; stroke?: number }) {
  const common = { stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G {...common}>{glyph(name, color)}</G>
    </Svg>
  );
}

function glyph(name: IconName, color: string) {
  switch (name) {
    case "session":
      return (
        <>
          <Rect x="6" y="5" width="12" height="14" rx="1" />
          <Path d="M3 8v8M21 8v8M1 11v2M23 11v2" />
        </>
      );
    case "calendar":
      return (
        <>
          <Rect x="3" y="4" width="18" height="18" rx="2" />
          <Path d="M16 2v4M8 2v4M3 10h18" />
        </>
      );
    case "list":
      return <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />;
    case "trend":
      return (
        <>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <Polyline points="16 7 22 7 22 13" />
        </>
      );
    case "sliders":
      return <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" />;
    case "back":
      return <Polyline points="15 18 9 12 15 6" />;
    case "next":
      return <Polyline points="9 18 15 12 9 6" />;
    case "chevron-down":
      return <Polyline points="6 9 12 15 18 9" />;
    case "close":
      return <Path d="M18 6 6 18M6 6l12 12" />;
    case "plus":
      return <Path d="M12 5v14M5 12h14" />;
    case "minus":
      return <Path d="M5 12h14" />;
    case "check":
      return <Polyline points="20 6 9 17 4 12" />;
    case "cross":
      return <Path d="M18 6 6 18M6 6l12 12" />;
    case "alert":
      return <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />;
    case "shield":
      return <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />;
    case "circle":
      return <Circle cx="12" cy="12" r="8" />;
    case "dot":
      return <Circle cx="12" cy="12" r="5" fill={color} />;
    case "up":
      return <Path d="M12 19V5M5 12l7-7 7 7" />;
    case "down":
      return <Path d="M12 5v14M19 12l-7 7-7-7" />;
    case "more":
      return (
        <>
          <Circle cx="12" cy="5" r="1.2" fill={color} />
          <Circle cx="12" cy="12" r="1.2" fill={color} />
          <Circle cx="12" cy="19" r="1.2" fill={color} />
        </>
      );
  }
}

/** The brand mark: two rising chevrons over a dumbbell. Ink on light grounds, lime on dark or on a contrast slab. */
export function LogoMark({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <G fill="none" stroke={color} strokeWidth={10} strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={10}>
        <Polyline points="16,40 48,12 80,40" />
        <Polyline points="30,58 48,42 66,58" />
      </G>
      <G fill={color}>
        <Rect x="30" y="72" width="36" height="7" />
        <Rect x="21" y="62" width="10" height="27" rx="2" />
        <Rect x="65" y="62" width="10" height="27" rx="2" />
        <Rect x="12" y="66" width="8" height="19" rx="2" />
        <Rect x="76" y="66" width="8" height="19" rx="2" />
        <Rect x="6" y="72" width="6" height="7" rx="1" />
        <Rect x="84" y="72" width="6" height="7" rx="1" />
      </G>
    </Svg>
  );
}

