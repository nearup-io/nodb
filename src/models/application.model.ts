import type { Environment } from "./environment.model";

export type Application = {
  id: string;
  name: string;
  environments: Environment[];
  image?: string | null;
  description?: string | null;
  extras?: Record<string, unknown>;
};
