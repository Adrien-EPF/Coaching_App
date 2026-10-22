import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";

export type AppearanceChoice = "system" | "light" | "dark";

const STORE_KEY = "appearance";

export const isAppearanceChoice = (v: unknown): v is AppearanceChoice => v === "system" || v === "light" || v === "dark";

/** Forces the whole app (screens, status bar, navigation) to a scheme; "system" gives control back to the phone. */
export function applyAppearance(choice: AppearanceChoice): void {
  Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
}

/** The saved choice, "system" until the athlete picks one. */
export async function getAppearance(): Promise<AppearanceChoice> {
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    return isAppearanceChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export async function setAppearance(choice: AppearanceChoice): Promise<void> {
  applyAppearance(choice);
  await SecureStore.setItemAsync(STORE_KEY, choice);
}
