// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { getOperationAST } from "graphql";
import type { Plugin } from "graphql-yoga";

interface Logger {
  error: (...args: unknown[]) => void;
}

/**
 * Recalculates Person.actedCount and directedCount after every mutation operation, before the response is sent,
 * so a client that refetches straight afterwards sees correct counts. It also runs when a mutation returned errors,
 * because a partly applied mutation could still have changed credits. A failed refresh is logged, not returned.
 */
export function useRefreshCounts(refresh: () => Promise<void>, logger: Logger = console): Plugin {
  return {
    onExecute({ args, executeFn, setExecuteFn }) {
      if (getOperationAST(args.document, args.operationName)?.operation !== "mutation") return;
      setExecuteFn(async (executeArgs) => {
        const result = await executeFn(executeArgs);
        try {
          await refresh();
        } catch (error) {
          logger.error("Failed to refresh Person counts after mutation", error);
        }
        return result;
      });
    },
  };
}
