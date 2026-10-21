import { readFile } from "node:fs/promises";
import type { Driver } from "neo4j-driver";

/** Splits a Cypher script into statements on semicolons at end of line. */
export function splitStatements(script: string): string[] {
  return script
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("//")));
}

/** Loads the seed script only when the target database has no Movie nodes. Returns true if it seeded. */
export async function seedIfEmpty(driver: Driver, database: string, seedPath: string): Promise<boolean> {
  const session = driver.session({ database });
  try {
    const res = await session.run("MATCH (m:Movie) RETURN count(m) AS n LIMIT 1");
    if (res.records[0].get("n").toNumber() > 0) return false;
    const statements = splitStatements(await readFile(seedPath, "utf8"));
    for (const statement of statements) await session.run(statement);
    return true;
  } finally {
    await session.close();
  }
}
