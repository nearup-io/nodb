import type { Environment } from "./environment.model";
import type { Token } from "./token.model.ts";

export type Application = {
  id: string;
  name: string;
  environments: Environment[];
  tokens: Token[];
  image?: string | null;
  description?: string | null;
  extras?: Record<string, unknown>;
};
