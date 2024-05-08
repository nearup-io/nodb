import * as R from "ramda";
import Entity from "../models/entity.model";
import { httpError } from "./const";
import { ServiceError } from "./service-errors";

export const isTypePathCorrect = (envEntities: string[], xpath: string) => {
  const xpathSegments = xpath.split("/");
  const typePath = xpathSegments.filter((_, i) => i % 2 === 0);
  return envEntities.includes(R.dropLast(1, typePath).join("/"));
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
