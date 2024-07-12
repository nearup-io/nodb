import * as R from "ramda";
import type { EntityQuery, QuerySortingOrder } from "./types.ts";
import { parseToPrimitive } from "./extras";
import type { EntityQueryParams } from "../routes/schemas/entity-schemas.ts";

export const mapQueryParams = (params: EntityQueryParams) => {
  let objProps: Record<string, unknown> = R.pickBy(
    (_, key) => typeof key === "string" && !key.startsWith("__"),
    params,
  );
  objProps = R.mapObjIndexed((val, _) => parseToPrimitive(val))(objProps);

  const entityQuery: EntityQuery = {
    meta: {
      only: params.__only,
      page: params.__page,
      perPage: params.__per_page,
      hasMeta: !params.__no_meta,
      sortBy: R.keys(params)
        .filter((key) => typeof key === "string" && key.startsWith("__sort_by"))
        .flatMap((key) => {
          if (key === "__sort_by_desc") {
            return (
              params.__sort_by_desc?.map((data) => ({
                name: data,
                order: "desc" as QuerySortingOrder,
              })) || []
            );
          }

          return (
            params.__sort_by?.map((data) => ({
              name: data,
              order: "asc" as QuerySortingOrder,
            })) || []
          );
        }),
    },
  };

  return { ...entityQuery, props: { ...objProps } };
};
