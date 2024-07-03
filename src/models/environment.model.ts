export type Token = {
  key: string;
  permission: "ALL" | "READ_ONLY";
};

export type Environment = {
  id: string;
  name: string;
  app?: string | null;
  extras?: Record<string, unknown>;
  tokens: Token[];
  entities: string[]; // only names/slugs ["my-entity", "movies"]
  description?: string | null;
};
