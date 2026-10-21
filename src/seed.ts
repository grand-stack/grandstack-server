import { readFile } from "node:fs/promises";
import type { Driver } from "neo4j-driver";

/** Splits a Cypher script into statements on semicolons at end of line. */
export function splitStatements(script: string): string[] {
  return script
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("//")));
}

/** Reads the `// seed-version: N` header from a seed script. Returns 1 when absent. */
export function seedVersion(script: string): number {
  const match = script.match(/^\/\/\s*seed-version:\s*(\d+)/m);
  return match ? Number(match[1]) : 1;
}

export type SeedDecision = "load" | "skip-current" | "skip-foreign";

/**
 * Decides whether to load the seed.
 * - Empty database: load.
 * - Database seeded by us (SeedMeta present): load only if the script version is newer.
 * - Movie nodes but no SeedMeta: the data is not ours, so leave it alone.
 */
export function decideSeed(movieCount: number, storedVersion: number | null, scriptVersion: number): SeedDecision {
  if (storedVersion !== null) return storedVersion < scriptVersion ? "load" : "skip-current";
  return movieCount === 0 ? "load" : "skip-foreign";
}

/**
 * Loads the seed script when appropriate. Returns the decision taken.
 * `probeLabel` is the node label used to detect existing data (the label of your main entity).
 */
export async function seedIfNeeded(
  driver: Driver,
  database: string,
  seedPath: string,
  probeLabel = "Movie",
): Promise<SeedDecision> {
  const script = await readFile(seedPath, "utf8");
  const version = seedVersion(script);
  const session = driver.session({ database });
  try {
    const res = await session.run(
      `OPTIONAL MATCH (meta:SeedMeta {name: 'movies'}) WITH meta OPTIONAL MATCH (m:\`${probeLabel}\`) RETURN meta.version AS version, count(m) AS n`,
    );
    const stored = res.records[0].get("version");
    const decision = decideSeed(res.records[0].get("n").toNumber(), stored === null ? null : Number(stored), version);
    if (decision !== "load") return decision;
    for (const statement of splitStatements(script)) await session.run(statement);
    await session.run("MERGE (meta:SeedMeta {name: 'movies'}) SET meta.version = $version", { version });
    return decision;
  } finally {
    await session.close();
  }
}

/** Runs idempotent setup Cypher files (constraints, indexes) at every start. Statements are split like the seed. */
export async function runSetupCypher(driver: Driver, database: string, paths: string[]): Promise<number> {
  let count = 0;
  const session = driver.session({ database });
  try {
    for (const path of paths) {
      for (const statement of splitStatements(await readFile(path, "utf8"))) {
        await session.run(statement);
        count++;
      }
    }
  } finally {
    await session.close();
  }
  return count;
}
