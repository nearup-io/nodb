import { z } from "zod";

export const errorSchema = z.object({
  message: z.string(),
  status: z.number().int().positive().gte(400),
});

export type APIError = z.infer<typeof errorSchema>;
