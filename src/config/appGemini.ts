import { Generate } from "../planner/gemini";
import { callGemini } from "../planner/geminiApi";
import { getGeminiKey } from "./geminiKey";

/** What the app plugs into the planner: a Gemini call with the stored key, or null when there is no key. */
export async function appGemini(): Promise<Generate | null> {
  const key = await getGeminiKey();
  return key ? (prompt) => callGemini(key, prompt) : null;
}
