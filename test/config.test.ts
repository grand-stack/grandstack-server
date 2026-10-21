import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { splitStatements } from "../src/seed.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig({ NEO4J_URI: "bolt://x:7687", NEO4J_PASSWORD: "pw" });
    expect(c).toMatchObject({ neo4jUsername: "neo4j", neo4jDatabase: "neo4j", port: 4000, seed: true });
  });
  it("reports every missing required variable", () => {
    expect(() => loadConfig({})).toThrow(/NEO4J_URI, NEO4J_PASSWORD/);
  });
  it("disables seeding with SEED=false", () => {
    expect(loadConfig({ NEO4J_URI: "a", NEO4J_PASSWORD: "b", SEED: "false" }).seed).toBe(false);
  });
  it("rejects a bad port", () => {
    expect(() => loadConfig({ NEO4J_URI: "a", NEO4J_PASSWORD: "b", PORT: "abc" })).toThrow(/PORT/);
  });
});

describe("splitStatements", () => {
  it("splits on terminating semicolons and drops comment-only chunks", () => {
    expect(splitStatements("// hi\nCREATE (a);\nCREATE (b);\n// end\n")).toEqual(["// hi\nCREATE (a)", "CREATE (b)"]);
  });
});
