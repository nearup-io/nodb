import type { Token } from "./token.model.ts";

export type Environment = {
  id: string;
  name: string;
  entities: string[]; // only names/slugs ["my-entity", "movies"]
  tokens: Token[];
  description?: string;
};
