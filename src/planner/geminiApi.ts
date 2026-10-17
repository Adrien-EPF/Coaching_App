const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

/** One Gemini call. The key goes in the request header to Google and nowhere else. */
export async function callGemini(key: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini: empty answer");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
