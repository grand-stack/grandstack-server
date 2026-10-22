// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import type { Driver } from "neo4j-driver";

/** Recomputes the stored credit counts for every person. Keep in step with the last statement of seed/movies.cypher. */
export const REFRESH_COUNTS_CYPHER =
  "MATCH (p:Person) SET p.actedCount = COUNT { (p)-[:ACTED_IN]->() }, p.directedCount = COUNT { (p)-[:DIRECTED]->() }";

export async function refreshCounts(driver: Driver, database: string): Promise<void> {
  const session = driver.session({ database });
  try {
    await session.run(REFRESH_COUNTS_CYPHER);
  } finally {
    await session.close();
  }
}
