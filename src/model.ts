// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** What a model sets up, before environment variables override it. */
export interface ModelDefaults {
  name: string;
  schemaPath: string;
  /** Run at every start, before any `SETUP_CYPHER_PATHS`. */
  setupCypherPath?: string;
  /** Absent when the model has no sample data. */
  seedPath?: string;
  seedProbeLabel: string;
  refreshCounts: boolean;
}

/** The file system, so the rules can be tested without one. */
export interface ModelIo {
  exists(path: string): boolean;
  readText(path: string): string;
  list(dir: string): string[];
}

export const realModelIo: ModelIo = {
  exists: (p) => existsSync(p),
  readText: (p) => readFileSync(p, "utf8"),
  list: (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []),
};

/** The model the image has always had: the sample Movies schema and seed, at the paths the image always used. */
export const BUILT_IN_MODEL = "movies";

const NAME = /^[a-z][a-z0-9-]*$/;
const JSON_KEYS = ["seedProbeLabel", "refreshCounts"];

/**
 * Finds a model by name. `movies` is built in. Any other name is a folder `<modelsDir>/<name>/` holding:
 *   schema.graphql   required
 *   setup.cypher     optional, idempotent statements run at every start
 *   seed.cypher      optional sample data, loaded by the usual seed rules
 *   model.json       optional: { "seedProbeLabel": "Instance", "refreshCounts": false }
 * A model with a seed must say which label detects existing data. The Person counts plugin belongs to Movies, so it is off by default
 * for every other model. Throws an error that says what to fix.
 */
export function resolveModel(name: string, modelsDir: string, io: ModelIo = realModelIo): ModelDefaults {
  if (name === BUILT_IN_MODEL) {
    return { name, schemaPath: "schema/schema.graphql", seedPath: "seed/movies.cypher", seedProbeLabel: "Movie", refreshCounts: true };
  }
  const available = () => [BUILT_IN_MODEL, ...io.list(modelsDir)].join(", ");
  // The name becomes part of a path, so it may not be able to leave the models folder
  if (!NAME.test(name)) throw new Error(`MODEL must be lower-case letters, digits and hyphens, starting with a letter, got "${name}"`);
  const dir = join(modelsDir, name);
  const schemaPath = join(dir, "schema.graphql");
  if (!io.exists(schemaPath)) throw new Error(`Unknown MODEL "${name}": there is no ${schemaPath} (available: ${available()})`);

  let json: Record<string, unknown> = {};
  const jsonPath = join(dir, "model.json");
  if (io.exists(jsonPath)) {
    try {
      json = JSON.parse(io.readText(jsonPath)) as Record<string, unknown>;
    } catch {
      throw new Error(`${jsonPath} is not valid JSON`);
    }
    const unknown = Object.keys(json).filter((k) => !JSON_KEYS.includes(k));
    if (unknown.length > 0) throw new Error(`${jsonPath} has unknown key(s): ${unknown.join(", ")} (allowed: ${JSON_KEYS.join(", ")})`);
    if ("refreshCounts" in json && typeof json.refreshCounts !== "boolean") throw new Error(`${jsonPath}: refreshCounts must be true or false`);
    if ("seedProbeLabel" in json && typeof json.seedProbeLabel !== "string") throw new Error(`${jsonPath}: seedProbeLabel must be a string`);
  }

  const setupPath = join(dir, "setup.cypher");
  const seedPath = join(dir, "seed.cypher");
  const hasSeed = io.exists(seedPath);
  if (hasSeed && typeof json.seedProbeLabel !== "string") {
    throw new Error(`MODEL "${name}" has a seed, so ${jsonPath} must set "seedProbeLabel" (the node label that shows data is already there)`);
  }
  return {
    name,
    schemaPath,
    setupCypherPath: io.exists(setupPath) ? setupPath : undefined,
    seedPath: hasSeed ? seedPath : undefined,
    seedProbeLabel: (json.seedProbeLabel as string | undefined) ?? "Movie",
    refreshCounts: (json.refreshCounts as boolean | undefined) ?? false,
  };
}
