import { validator } from "hono/validator";
import * as R from "ramda";
import { z } from "zod";
import type { EntityQuery, Order } from "./types.ts";
import { parseToPrimitive } from "./extras";

const entityQuerySchema = z.object({
  __only: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.string().array())
    .optional(),
  __page: z.preprocess(Number, z.number()).optional(),
  __per_page: z.preprocess(Number, z.number()).optional(),
  __no_meta: z
    .enum(["true", "false", "0", "1"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
  __sort_by: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.string().array())
    .optional(),
  __sort_by_desc: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.string().array())
    .optional(),
});

export const entityQueryValidator = () => {
  return validator("query", (value, c) => {
    const parsed = entityQuerySchema.safeParse(value);

    let objProps: Record<string, unknown> = R.pickBy(
      (_, key) => !key.startsWith("__"),
      value,
    );
    objProps = R.mapObjIndexed((val, _) => parseToPrimitive(val))(objProps);
    if (!parsed.success) {
      return c.text("Invalid query", 400);
    }

    const entityQuery: EntityQuery = {
      meta: {
        only: parsed.data.__only,
        page: parsed.data.__page,
        perPage: parsed.data.__per_page,
        hasMeta: !parsed.data.__no_meta,
        sortBy: R.keys(value)
          .filter((key) => key.startsWith("__sort_by"))
          .flatMap((key) => {
            if (key === "__sort_by_desc") {
              return (
                parsed.data.__sort_by_desc?.map((data) => ({
                  name: data,
                  order: "desc" as Order,
                })) || []
              );
            }

            return (
              parsed.data.__sort_by?.map((data) => ({
                name: data,
                order: "asc" as Order,
              })) || []
            );
          }),
      },
    };

    return { ...entityQuery, props: { ...objProps } };
  });
};
