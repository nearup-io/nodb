import * as R from "ramda";
import Entity from "../models/entity.model";
import { httpError } from "./const";
import { ServiceError } from "./service-errors";
import type { EntityQueryMeta, SortBy } from "./types.ts";

export const isTypePathCorrect = (envEntities: string[], xpath: string) => {
  const xpathSegments = xpath.split("/");
  const typePath = xpathSegments.filter((_, i) => i % 2 === 0);
  return envEntities.includes(R.dropLast(1, typePath).join("/"));
};

export const getOnlyArrayFromQuery = (only: string[] | undefined) => {
  return Array.isArray(only) ? only.join(",") : only;
};

export const getAggregateQuery = ({
  xpathEntitySegments,
  modelFilters,
  metaFilters,
  paginationQuery: { skip, limit },
  appName,
  envName,
}: {
  xpathEntitySegments: string[];
  modelFilters: Record<string, unknown>;
  metaFilters?: EntityQueryMeta;
  paginationQuery: { skip: number; limit: number };
  appName: string;
  envName: string;
}) => {
  const parentId =
    xpathEntitySegments.length > 1 ? R.nth(-2, xpathEntitySegments) : null;
  const ancestors = xpathEntitySegments.filter((_, i) => i % 2 === 1);
  const entityTypes = xpathEntitySegments.filter((_, i) => i % 2 === 0);
  const pagiQuery = [{ $skip: skip }, { $limit: limit }];
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

export const getPaginationNumbers = ({
  page,
  perPage,
}: {
  page?: number;
  perPage?: number;
}): { skip: number; limit: number } => {
  let paginationLimit = perPage || 10;
  if (paginationLimit < 1) {
    paginationLimit = 10;
  }
  let paginationOffset = page ? page - 1 : 0;
  if (paginationOffset < 1) {
    paginationOffset = 0;
  }
  paginationOffset *= paginationLimit;
  return { skip: paginationOffset, limit: paginationLimit };
};

export const entityMetaResponse = ({
  hasMeta,
  xpathEntitySegments,
  appName,
  envName,
  id,
}: {
  hasMeta?: boolean;
  xpathEntitySegments: string[];
  appName: string;
  envName: string;
  id: string;
}) => {
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

export const throwIfNoParent = async (parentId: string) => {
  const parent = await Entity.findOne({
    id: parentId,
  });
  if (!parent) {
    throw new ServiceError(httpError.ENTITY_NO_PARENT);
  }
};

export const getEntityTypes = (xpathEntitySegments: string[]): string[] =>
  xpathEntitySegments.filter((_: any, i: number) => i % 2 === 0);
export const getAncestors = (xpathEntitySegments: string[]): string[] =>
  xpathEntitySegments.filter((_: any, i: number) => i % 2 !== 0);
