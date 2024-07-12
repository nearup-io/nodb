import { z } from "zod";

export const tokenSchema = z.object({
  key: z.string(),
  permission: z.enum(["ALL", "READ_ONLY"]),
});
