// Newest first. Google keeps older models for existing users only, so a new key can get a 404 on a retired one.
const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const TIMEOUT_MS = 30_000;

/** One Gemini call. The key goes in the request header to Google and nowhere else. */
export async function callGemini(key: string, prompt: string): Promise<string> {
  let failure: Error | null = null;
  for (const model of MODELS) {
    try {
      return await callModel(key, model, prompt);
    } catch (e) {
      failure = e instanceof Error ? e : new Error(String(e));
      // Only an unknown model is worth another model; a bad key or a quota would fail the same way.
      if (!(failure instanceof ModelNotFound)) throw failure;
    }
  }
  throw failure ?? new Error("Gemini: aucun modèle disponible");
}

class ModelNotFound extends Error {}

async function callModel(key: string, model: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint(model), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const message = await errorMessage(res);
      const text = `Gemini HTTP ${res.status}${message ? ` : ${message}` : ""}`;
      throw res.status === 404 ? new ModelNotFound(text) : new Error(text);
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini: réponse vide");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Google's own explanation of a failure ("API key not valid", "quota exceeded"...), when it gave one. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return (body.error?.message ?? "").slice(0, 160);
  } catch {
    return "";
  }
}
