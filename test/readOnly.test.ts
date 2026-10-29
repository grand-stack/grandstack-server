// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { readFileSync } from "node:fs";
import { Neo4jGraphQL } from "@neo4j/graphql";
import { describe, expect, it } from "vitest";
import { addReadOnly } from "../src/readOnly.js";

const schema = (typeDefs: string) => new Neo4jGraphQL({ typeDefs }).getSchema();

describe("addReadOnly", () => {
  it("adds @mutation(operations: []) to every node type, and nothing else", () => {
    const out = addReadOnly(`type A @node { id: ID! }\ntype B @node { id: ID! }\ntype Plain { id: ID! }\ninterface I { id: ID! }`);
    expect(out).toContain("extend type A @mutation(operations: [])");
    expect(out).toContain("extend type B @mutation(operations: [])");
    expect(out).not.toContain("extend type Plain");
    expect(out).not.toContain("extend type I");
  });

  it("leaves a type alone that already says what its mutations are", () => {
    const out = addReadOnly(`type A @node @mutation(operations: [CREATE]) { id: ID! }\ntype B @node { id: ID! }\nextend type C @mutation(operations: [])\ntype C @node { id: ID! }`);
    expect(out).not.toContain("extend type A @mutation(operations: [])");
    expect(out.match(/extend type C /g)).toHaveLength(1);
    expect(out).toContain("extend type B @mutation(operations: [])");
  });

  it("finds a node type that is declared with an extension", () => {
    expect(addReadOnly(`type A { id: ID! }\nextend type A @node`)).toContain("extend type A @mutation(operations: [])");
  });

  it("returns the schema untouched when there are no node types", () => {
    const text = "type Query { x: Int }";
    expect(addReadOnly(text)).toBe(text);
  });

  it("removes every generated mutation, and the Movies schema without it has them", async () => {
    const movies = readFileSync("schema/schema.graphql", "utf8");
    expect(Object.keys((await schema(movies)).getMutationType()?.getFields() ?? {}).length).toBeGreaterThan(0);
    expect((await schema(addReadOnly(movies))).getMutationType()).toBeUndefined();
  });

  it("still serves every query", async () => {
    const movies = readFileSync("schema/schema.graphql", "utf8");
    const before = Object.keys((await schema(movies)).getQueryType()!.getFields()).sort();
    expect(Object.keys((await schema(addReadOnly(movies))).getQueryType()!.getFields()).sort()).toEqual(before);
  });
});
