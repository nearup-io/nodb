import { z } from "zod";

export const SecuritySchema = z
  .object({
    authorization: z.string().optional(),
    token: z.string().optional(),
  })
  .refine(
    (data) => {
      return data["authorization"] !== undefined || data["token"] !== undefined;
    },
    {
      message: "Either authorization header or token header must be provided",
    },
  );
