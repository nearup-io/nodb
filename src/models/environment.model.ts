import type { Token } from "./token.model.ts";

export type Environment = {
  id: string;
  name: string;
  extras?: Record<string, unknown>;
  entities: string[]; // only names/slugs ["my-entity", "movies"]
  tokens: Token[];
  description?: string;
};
