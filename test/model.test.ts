// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { resolveModel, type ModelIo } from "../src/model.js";

/** A pretend file system: a map of path to text, and the folders under models/. */
function fakeIo(files: Record<string, string>): ModelIo {
  return {
    exists: (p) => p in files,
    readText: (p) => files[p]!,
    list: (d) => [...new Set(Object.keys(files).filter((p) => p.startsWith(`${d}/`)).map((p) => p.slice(d.length + 1).split("/")[0]!))],
  };
}

const AURA = {
  "models/aura/schema.graphql": "type A @node { id: ID! }",
  "models/aura/setup.cypher": "CREATE CONSTRAINT a IF NOT EXISTS FOR (n:A) REQUIRE n.id IS UNIQUE;",
};

describe("resolveModel", () => {
  it("has the Movies model built in, at the paths the image has always used", () => {
    expect(resolveModel("movies", "models", fakeIo({}))).toEqual({
      name: "movies", schemaPath: "schema/schema.graphql", seedPath: "seed/movies.cypher", seedProbeLabel: "Movie", refreshCounts: true,
    });
  });

  it("reads another model from its folder, with the counts plugin off and no seed", () => {
    expect(resolveModel("aura", "models", fakeIo(AURA))).toEqual({
      name: "aura", schemaPath: "models/aura/schema.graphql", setupCypherPath: "models/aura/setup.cypher", seedPath: undefined, seedProbeLabel: "Movie", refreshCounts: false,
    });
  });

  it("uses a model.json, and a seed needs a probe label to go with it", () => {
    const files = { ...AURA, "models/aura/seed.cypher": "// seed-version: 1", "models/aura/model.json": '{ "seedProbeLabel": "Instance", "refreshCounts": true }' };
    expect(resolveModel("aura", "models", fakeIo(files))).toMatchObject({ seedPath: "models/aura/seed.cypher", seedProbeLabel: "Instance", refreshCounts: true });
    const noLabel = { ...AURA, "models/aura/seed.cypher": "// seed-version: 1" };
    expect(() => resolveModel("aura", "models", fakeIo(noLabel))).toThrow(/must set "seedProbeLabel"/);
  });

  it("names the models that exist when the name is wrong", () => {
    expect(() => resolveModel("auro", "models", fakeIo(AURA))).toThrow(/Unknown MODEL "auro".*available: movies, aura/);
  });

  it("does not let a name leave the models folder", () => {
    for (const bad of ["../etc", "a/b", "Aura", "1aura", "", "aura.json"]) {
      expect(() => resolveModel(bad, "models", fakeIo(AURA))).toThrow(/MODEL must be/);
    }
  });

  it("rejects a model.json that is not JSON, has a typo, or has the wrong type", () => {
    const withJson = (text: string) => fakeIo({ ...AURA, "models/aura/model.json": text });
    expect(() => resolveModel("aura", "models", withJson("{"))).toThrow(/not valid JSON/);
    expect(() => resolveModel("aura", "models", withJson('{ "refreshCount": false }'))).toThrow(/unknown key\(s\): refreshCount/);
    expect(() => resolveModel("aura", "models", withJson('{ "refreshCounts": "no" }'))).toThrow(/refreshCounts must be true or false/);
    expect(() => resolveModel("aura", "models", withJson('{ "seedProbeLabel": 3 }'))).toThrow(/seedProbeLabel must be a string/);
  });
});

describe("loadConfig with a model", () => {
  const base = { NEO4J_URI: "a", NEO4J_PASSWORD: "b" };

  it("is Movies when nothing is set, exactly as before", () => {
    expect(loadConfig(base, fakeIo({}))).toMatchObject({
      model: "movies", schemaPath: "schema/schema.graphql", seedPath: "seed/movies.cypher", seed: true, seedProbeLabel: "Movie", refreshCounts: true, readOnly: false, setupCypherPaths: [],
    });
  });

  it("takes the schema, setup and defaults from the model", () => {
    expect(loadConfig({ ...base, MODEL: "aura" }, fakeIo(AURA))).toMatchObject({
      model: "aura", schemaPath: "models/aura/schema.graphql", seed: false, seedPath: undefined, refreshCounts: false, setupCypherPaths: ["models/aura/setup.cypher"],
    });
  });

  it("runs the model's setup first and then SETUP_CYPHER_PATHS", () => {
    expect(loadConfig({ ...base, MODEL: "aura", SETUP_CYPHER_PATHS: "/x.cypher, /y.cypher" }, fakeIo(AURA)).setupCypherPaths).toEqual(["models/aura/setup.cypher", "/x.cypher", "/y.cypher"]);
  });

  it("lets an explicit variable win over the model", () => {
    const c = loadConfig({ ...base, MODEL: "aura", SCHEMA_PATH: "/mine.graphql", REFRESH_COUNTS: "true", MODELS_DIR: "m" }, fakeIo({ "m/aura/schema.graphql": "x" }));
    expect(c).toMatchObject({ schemaPath: "/mine.graphql", refreshCounts: true, modelsDir: "m" });
  });

  it("turns the seed on for a model that has one, and off with SEED=false", () => {
    const files = { ...AURA, "models/aura/seed.cypher": "x", "models/aura/model.json": '{ "seedProbeLabel": "A" }' };
    expect(loadConfig({ ...base, MODEL: "aura" }, fakeIo(files))).toMatchObject({ seed: true, seedPath: "models/aura/seed.cypher", seedProbeLabel: "A" });
    expect(loadConfig({ ...base, MODEL: "aura", SEED: "false" }, fakeIo(files)).seed).toBe(false);
  });

  it("refuses SEED=true for a model with nothing to seed", () => {
    expect(() => loadConfig({ ...base, MODEL: "aura", SEED: "true" }, fakeIo(AURA))).toThrow(/has no seed.cypher/);
  });

  it("reads READ_ONLY in any letter case", () => {
    expect(loadConfig({ ...base, READ_ONLY: "TRUE" }, fakeIo({})).readOnly).toBe(true);
    expect(loadConfig({ ...base, READ_ONLY: "false" }, fakeIo({})).readOnly).toBe(false);
  });

  it("still checks the probe label, wherever it came from", () => {
    const files = { ...AURA, "models/aura/seed.cypher": "x", "models/aura/model.json": '{ "seedProbeLabel": "A) DETACH DELETE (n" }' };
    expect(() => loadConfig({ ...base, MODEL: "aura" }, fakeIo(files))).toThrow(/SEED_PROBE_LABEL/);
  });
});
