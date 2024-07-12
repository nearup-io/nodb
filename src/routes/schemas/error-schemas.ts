import { z } from "zod";

export const ErrorSchema = z.object({
  message: z.string(),
  status: z.number().int().positive().gte(400),
});

export type APIError = z.infer<typeof ErrorSchema>;
