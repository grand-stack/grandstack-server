import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { decideSeed, seedVersion, splitStatements } from "../src/seed.js";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const c = loadConfig({ NEO4J_URI: "bolt://x:7687", NEO4J_PASSWORD: "pw" });
    expect(c).toMatchObject({ neo4jUsername: "neo4j", neo4jDatabase: "neo4j", port: 4000, seed: true, corsOrigin: "http://localhost:3000", neo4jAddCypherVersionPrefix: false });
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

describe("seed versioning", () => {
  it("reads the version header, defaulting to 1", () => {
    expect(seedVersion("// x\n// seed-version: 7\nCREATE (a);")).toBe(7);
    expect(seedVersion("CREATE (a);")).toBe(1);
  });
  it("loads into an empty database", () => expect(decideSeed(0, null, 2)).toBe("load"));
  it("leaves foreign Movie data alone", () => expect(decideSeed(10, null, 2)).toBe("skip-foreign"));
  it("skips when current, reloads when the script is newer", () => {
    expect(decideSeed(152, 2, 2)).toBe("skip-current");
    expect(decideSeed(152, 1, 2)).toBe("load");
  });
});
