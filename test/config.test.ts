// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
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

describe("generalisation settings", () => {
  const base = { NEO4J_URI: "a", NEO4J_PASSWORD: "b" };
  it("defaults to the Movie probe label and refreshing counts", () => {
    expect(loadConfig(base)).toMatchObject({ seedProbeLabel: "Movie", refreshCounts: true });
  });
  it("accepts a custom label and can switch the counts refresh off", () => {
    expect(loadConfig({ ...base, SEED_PROBE_LABEL: "Book", REFRESH_COUNTS: "false" })).toMatchObject({ seedProbeLabel: "Book", refreshCounts: false });
  });
  it("rejects a label that could break the Cypher", () => {
    expect(() => loadConfig({ ...base, SEED_PROBE_LABEL: "Book) DETACH DELETE (n" })).toThrow(/SEED_PROBE_LABEL/);
  });
});

describe("auth and extra schema settings", () => {
  const base = { NEO4J_URI: "a", NEO4J_PASSWORD: "b" };
  const auth = { AUTH_JWKS_URL: "http://kc:8080/certs", AUTH_ISSUER: "http://localhost:8081/realms/x", AUTH_AUDIENCE: "api" };
  it("is off by default", () => {
    expect(loadConfig(base)).toMatchObject({ auth: undefined, schemaExtraPaths: [], setupCypherPaths: [] });
  });
  it("turns on when all three auth variables are set", () => {
    expect(loadConfig({ ...base, ...auth }).auth).toEqual({ jwksUrl: auth.AUTH_JWKS_URL, issuer: auth.AUTH_ISSUER, audience: "api" });
  });
  it("refuses a partial auth configuration and names what is missing", () => {
    expect(() => loadConfig({ ...base, AUTH_JWKS_URL: auth.AUTH_JWKS_URL })).toThrow(/missing: AUTH_ISSUER, AUTH_AUDIENCE/);
  });
  it("requires an http(s) JWKS URL", () => {
    expect(() => loadConfig({ ...base, ...auth, AUTH_JWKS_URL: "kc/certs" })).toThrow(/http\(s\) URL/);
  });
  it("splits extra schema and setup Cypher paths", () => {
    expect(loadConfig({ ...base, SCHEMA_EXTRA_PATHS: " a.graphql, b.graphql ,", SETUP_CYPHER_PATHS: "x.cypher" })).toMatchObject({
      schemaExtraPaths: ["a.graphql", "b.graphql"], setupCypherPaths: ["x.cypher"],
    });
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

describe("federation setting", () => {
  const base = { NEO4J_URI: "a", NEO4J_PASSWORD: "b" };
  it("is off by default", () => {
    expect(loadConfig(base).federation).toBe(false);
  });
  it("turns on with FEDERATION=true in any letter case", () => {
    expect(loadConfig({ ...base, FEDERATION: "TRUE" }).federation).toBe(true);
    expect(loadConfig({ ...base, FEDERATION: "false" }).federation).toBe(false);
  });
});
