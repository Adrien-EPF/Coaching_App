import * as SecureStore from "expo-secure-store";

const STORE_KEY = "gemini_api_key";

// Dev fallback, read from .env at build time (see .env.example).
const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || null;

/** Key entered in the app's settings (stored on the device), else the .env key. */
export async function getGeminiKey(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(STORE_KEY);
  return stored?.trim() || envKey;
}

export async function setGeminiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, key.trim());
}

export async function clearGeminiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}
