import { validator } from "hono/validator";
import * as R from "ramda";
import { z } from "zod";
import type { EntityQuery } from "./entity-utils";
import { parseToPrimitive } from "./extras";

const entityQueryschema = z.object({
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
});

export const entityQueryValidator = () =>
  validator("query", (value, c) => {
    const parsed = entityQueryschema.safeParse(value);
    let objProps = R.pickBy((_, key) => !key.startsWith("__"), value) as Record<
      string,
      unknown
    >;
    objProps = R.mapObjIndexed((val, _) => parseToPrimitive(val))(objProps);
    if (!parsed.success) {
      return c.text("Invalid query", 400);
    }
    const entityQuery = {
      meta: {
        only: parsed.data.__only,
        page: parsed.data.__page,
        perPage: parsed.data.__per_page,
        sortBy: parsed.data.__sort_by,
        hasMeta: !parsed.data.__no_meta,
      },
    } as EntityQuery;
    const result = { ...entityQuery, props: { ...objProps } };
    return result;
  });
