import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, loadRules } from "../src/rules/rules";

function yamlFromRulesDoc(): unknown {
  const md = readFileSync(new URL("../RULES.md", import.meta.url), "utf8");
  const block = /```yaml\r?\n([\s\S]*?)```/.exec(md);
  if (!block) throw new Error("No YAML block in RULES.md");
  return load(block[1]);
}

describe("Rules config", () => {
  it("the shipped config is the YAML block of RULES.md", () => {
    expect(loadRules(yamlFromRulesDoc())).toEqual(DEFAULT_RULES);
  });

  it("is versioned", () => {
    expect(DEFAULT_RULES.version).toBe(1);
  });

  it("rejects a config with a broken Guardrail, saying where", () => {
    const bad = structuredClone(DEFAULT_RULES) as unknown as { guardrails: { max_increase_pct: unknown } };
    bad.guardrails.max_increase_pct = "dix";
    expect(() => loadRules(bad)).toThrow(/guardrails\.max_increase_pct/);
  });

  it("rejects a goal whose rep range is inverted", () => {
    const bad = structuredClone(DEFAULT_RULES);
    bad.goals.strength.reps_range = [5, 1];
    expect(() => loadRules(bad)).toThrow(/goals\.strength\.reps_range/);
  });

  it("rejects an increment without a step", () => {
    const bad = structuredClone(DEFAULT_RULES);
    bad.increments.barbell.min_step = 0;
    expect(() => loadRules(bad)).toThrow(/increments\.barbell/);
  });

  it("rejects something that is not a config", () => {
    expect(() => loadRules(null)).toThrow();
    expect(() => loadRules({ version: 1 })).toThrow();
  });
});
