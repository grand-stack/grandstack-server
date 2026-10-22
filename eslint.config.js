// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import graphql from "@graphql-eslint/eslint-plugin";

export default [
  {
    files: ["schema/**/*.graphql"],
    languageOptions: { parser: graphql.parser },
    plugins: { "@graphql-eslint": graphql },
    rules: {
      "@graphql-eslint/require-description": ["error", { types: true, FieldDefinition: true, InputValueDefinition: true, EnumValueDefinition: true, rootField: true }],
      "@graphql-eslint/naming-convention": ["error", { types: "PascalCase", FieldDefinition: "camelCase" }],
    },
  },
];
