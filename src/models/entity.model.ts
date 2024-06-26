export type Entity = {
  id: string;
  type: string;
  model: Record<string, unknown>;
  extras?: Record<string, unknown>;
  embedding?: number[] | null;
};
