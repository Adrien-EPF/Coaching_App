import { useColorScheme } from "react-native";

/** Design tokens from Design/coaching-app/design-system/tokens.json (light and dark). */
const light = {
  surface: "#f4f5f0",
  surfaceRaised: "#ffffff",
  surfaceSunken: "#e7e9e0",
  ink: "#111410",
  inkMuted: "#52574d",
  inkSubtle: "#6c7166",
  line: "#d9dcd1",
  lineStrong: "#868b80",
  lime: "#c6f432",
  onLime: "#111410",
  limeInk: "#3f5a00",
  limeSoft: "#ecf9c4",
  contrast: "#111410",
  onContrast: "#f4f5f0",
  focus: "#2443d6",
  scrim: "rgba(17, 20, 16, 0.48)",
  strengthInk: "#4c2a85",
  hypertrophyInk: "#b0246a",
  enduranceInk: "#00657f",
  danger: "#b42318",
  onDanger: "#ffffff",
  warningInk: "#8a5a00",
};

const dark: typeof light = {
  surface: "#0e100d",
  surfaceRaised: "#1a1d17",
  surfaceSunken: "#252920",
  ink: "#f1f3ec",
  inkMuted: "#a6ab9f",
  inkSubtle: "#8b9084",
  line: "#2b2f27",
  lineStrong: "#71766a",
  lime: "#c6f432",
  onLime: "#111410",
  limeInk: "#c6f432",
  limeSoft: "#27310c",
  contrast: "#f1f3ec",
  onContrast: "#0e100d",
  focus: "#8ea2ff",
  scrim: "rgba(0, 0, 0, 0.64)",
  strengthInk: "#b9a3f2",
  hypertrophyInk: "#ff8fbd",
  enduranceInk: "#8fdcf5",
  danger: "#ff6b5e",
  onDanger: "#111410",
  warningInk: "#f5c33b",
};

export type Colors = typeof light;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
export const radius = { xs: 4, sm: 8, md: 10, lg: 12, pill: 999 } as const;

export const fonts = {
  display: "SofiaSansCondensed_800ExtraBold",
  displayBold: "SofiaSansCondensed_700Bold",
  sans: "Barlow_400Regular",
  sansMedium: "Barlow_500Medium",
  sansSemi: "Barlow_600SemiBold",
  sansBold: "Barlow_700Bold",
} as const;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === "dark";
}
