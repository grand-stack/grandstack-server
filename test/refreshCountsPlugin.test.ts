import { parse } from "graphql";
import { describe, expect, it, vi } from "vitest";
import { useRefreshCounts } from "../src/refreshCountsPlugin.js";

// Runs the plugin's onExecute the way Envelope would and returns the result of the (possibly wrapped) execute function.
async function run(source: string, refresh: () => Promise<void>, executeFn = async () => ({ data: { ok: true } })) {
  const logger = { error: vi.fn() };
  const plugin = useRefreshCounts(refresh, logger);
  let current: (args: unknown) => unknown = executeFn as never;
  const document = parse(source);
  (plugin.onExecute as never as (a: unknown) => void)({
    args: { document, operationName: undefined },
    executeFn: executeFn as never,
    setExecuteFn: (fn: never) => { current = fn; },
  });
  return { result: await current({ document }), logger };
}

describe("useRefreshCounts", () => {
  it("refreshes after a mutation, before returning the result", async () => {
    const order: string[] = [];
    const refresh = vi.fn(async () => { order.push("refresh"); });
    const exec = async () => { order.push("execute"); return { data: { ok: true } }; };
    const { result } = await run("mutation { x }", refresh, exec);
    expect(order).toEqual(["execute", "refresh"]);
    expect(result).toEqual({ data: { ok: true } });
  });
  it("does nothing for queries", async () => {
    const refresh = vi.fn(async () => {});
    await run("query { x }", refresh);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("still refreshes when the mutation returned errors", async () => {
    const refresh = vi.fn(async () => {});
    await run("mutation { x }", refresh, async () => ({ errors: [new Error("boom")] }) as never);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("logs a refresh failure without failing the mutation", async () => {
    const { result, logger } = await run("mutation { x }", async () => { throw new Error("db down"); });
    expect(result).toEqual({ data: { ok: true } });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
