import { z } from "zod";

const ClerkJwtSchema = z.object({
  jwt: z.string().optional(),
});

const BackendTokenSchema = z.object({
  token: z.string().optional(),
});

export const SecuritySchema = z
  .object({
    jwt: z.string().optional(),
    token: z.string().optional(),
  })
  .refine((data) => data["jwt"] !== undefined || data["token"] !== undefined, {
    message: "Either jwt or token must be provided",
  });
