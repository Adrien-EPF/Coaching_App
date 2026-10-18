import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFr, maskFr, parseFr } from "../src/domain/format";
import { callGemini } from "../src/planner/geminiApi";

describe("JJ/MM/AAAA dates", () => {
  it("formats and parses", () => {
    expect(formatFr("2026-10-17")).toBe("17/10/2026");
    expect(parseFr("17/10/2026")).toBe("2026-10-17");
    expect(parseFr("1/3/2027")).toBe("2027-03-01");
  });

  it("rejects what is not a real date", () => {
    expect(parseFr("31/02/2026")).toBeNull();
    expect(parseFr("2026-10-17")).toBeNull();
    expect(parseFr("")).toBeNull();
  });

  it("adds the slashes while typing", () => {
    expect(maskFr("17102026")).toBe("17/10/2026");
    expect(maskFr("171")).toBe("17/1");
  });
});

describe("the Gemini model", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to an older model when the newest is unknown to the key", async () => {
    const ok = JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] });
    const fetchMock = vi.fn(async (url: string) => (url.includes("gemini-3.8-flash") ? new Response("{}", { status: 404 }) : new Response(ok, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callGemini("k", "hi")).resolves.toBe("{}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports Google's reason when the key is refused, without trying other models", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callGemini("k", "hi")).rejects.toThrow(/400.*API key not valid/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
