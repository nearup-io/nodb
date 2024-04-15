import * as R from "ramda";

export const dropAppnameEnvname = R.drop(2);
export const getXpathSegments = R.pipe(R.split("/"), dropAppnameEnvname);
export type EntityReqParams = {
  appName: string;
  envName: string;
  entityName: string;
};

export type Order = "desc" | "asc";
export type SortBy = { name: string; order: Order };
export type EntityQueryMeta = {
  only?: string[];
  page?: number;
  perPage?: number;
  sortBy: SortBy[];
  hasMeta: boolean;
};
export type EntityQuery = {
  meta: EntityQueryMeta;
  [key: string]: unknown;
};

export const isTypePathCorrect = (envEntities: string[], xpath: string) => {
  const xpathSegments = xpath.split("/");
  const typePath = xpathSegments.filter((_, i) => i % 2 === 0);
  return envEntities.includes(R.dropLast(1, typePath).join("/"));
};

export const getOnlyArrayFromQuery = (only: string[] | undefined) => {
  return Array.isArray(only) ? only.join(",") : only;
};

export const getAggregateQuery = ({
  xpath,
  modelFilters,
  metaFilters,
}: {
  xpath: string;
  modelFilters: Record<string, unknown>;
  metaFilters?: EntityQueryMeta;
}) => {
  const [appName, envName] = R.take(2, xpath.split("/"));
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const parentId =
    xpathEntitySegments.length > 1 ? R.nth(-2, xpathEntitySegments) : null;
  const ancestors = xpathEntitySegments.filter((_, i) => i % 2 === 1);
  const entityTypes = xpathEntitySegments.filter((_, i) => i % 2 === 0);
  const pagiQuery = getPaginationDbQuery({
    page: metaFilters?.page,
    perPage: metaFilters?.perPage,
  });
  const sortQuery = getSortDbQuery(metaFilters?.sortBy);
  const stage2 = [sortQuery, ...pagiQuery].filter(R.pipe(R.isEmpty, R.not));
  return [
    {
      $match: {
        ancestors: parentId === null ? [] : ancestors,
        type: {
          $regex: new RegExp(
            `\\b(${appName}/${envName}/${entityTypes.join("/")})\\b`,
          ),
        },
        ...modelFilters,
      },
    },
    {
      $facet: {
        stage1: [{ $group: { _id: 0, count: { $sum: 1 } } }],
        stage2,
      },
    },
    { $unwind: "$stage1" },
    {
      $project: {
        _id: 0,
        totalCount: "$stage1.count",
        entities: "$stage2",
      },
    },
  ];
};

export const getPaginationDbQuery = ({
  page,
  perPage,
}: {
  page?: number;
  perPage?: number;
}) => {
  let paginationLimit = perPage || 10;
  if (paginationLimit < 1) {
    paginationLimit = 10;
  }
  let paginationOffset = page || 0;
  if (paginationOffset < 1) {
    paginationOffset = 0;
  }
  paginationOffset *= paginationLimit;
  return [{ $skip: paginationOffset }, { $limit: paginationLimit }];
};

export const entityMetaResponse = ({
  hasMeta,
  xpath,
  id,
}: {
  hasMeta?: boolean;
  xpath: string;
  id: string;
}) => {
  const [appName, envName] = R.take(2, xpath.split("/"));
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  return hasMeta
    ? {
        self: `/${appName}/${envName}/${xpathEntitySegments.join("/")}/${id}`,
      }
    : undefined;
};

export const toModelFilters = (filters: Record<string, unknown>) => {
  // {
  //   "foo": "bar" -> "model.foo": "bar"
  //   "baz": "bux" -> "model.baz": "bux"
  // }
  const filtersKeys = R.keys(filters);
  const modelFilters = filtersKeys
    .map((k: string) => {
      return { [`model.${k}`]: filters[k] };
    })
    .reduce((acc, cur) => {
      acc[R.keys(cur)[0]] = R.values(cur)[0];
      return acc;
    }, {});
  return modelFilters;
};

const getSortDbQuery = (
  sortBy: SortBy[] | undefined,
): {} | { $sort: Record<string, 1 | -1> } => {
  const initObj: Record<string, 1 | -1> = {};

  if (!sortBy || R.isEmpty(sortBy)) {
    return initObj;
  }

  const sort = sortBy.reduce((acc, cur) => {
    if (!acc[`model.${cur.name}`]) {
      acc[`model.${cur.name}`] = cur.order === "asc" ? 1 : -1;
    }

    return acc;
  }, initObj);

  return { $sort: sort };
};
