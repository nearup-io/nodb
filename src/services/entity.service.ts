import * as R from "ramda";
import EntityModel, { type IEntity } from "../models/entity.model";
import EnvironmentModel, {
  type Environment,
} from "../models/environment.model";
import generateToken from "../utils/backend-token";
import { httpError } from "../utils/const";
import {
  getAggregateQuery,
  getXpathSegments,
  isTypePathCorrect,
  toModelFilters,
  type EntityQueryMeta,
} from "../utils/entity-utils";
import { ServiceError } from "../utils/service-errors";
import { findEnvironment } from "./environment.service";

export const getEntities = async ({
  xpath,
  propFilters,
  metaFilters,
}: {
  xpath: string;
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
}) => {
  const modelFilters = toModelFilters(propFilters);
  const aggregateQuery = getAggregateQuery({
    modelFilters,
    metaFilters,
    xpath,
  }) as Record<string, any>;
  const entitiesAggregationResponse = await EntityModel.aggregate(
    // @ts-ignore TODO: using $sort raises "No overload matches this call"
    aggregateQuery
  );
  const entities = R.path(["entities"], R.head(entitiesAggregationResponse));
  return entities;
};

export const createOrOverwriteEntities = async ({
  appName,
  envName,
  entityName,
  restSegments,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  entityName: string;
  restSegments: string[];
  bodyEntities: Omit<IEntity, "id">[];
}) => {
  const xpath = R.isEmpty(restSegments)
    ? `${appName}/${envName}/${entityName}`
    : `${appName}/${envName}/${entityName}/${restSegments.join("/")}`;
  const environment = (await findEnvironment({
    appName,
    envName,
  })) as Environment;
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const parentIdFromXpath = R.nth(-2, xpathEntitySegments);
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 1
  );
  if (xpathEntitySegments.length > 1) {
    const entityChecker = await EntityModel.findOne({
      id: parentIdFromXpath,
    });
    if (!entityChecker) {
      throw new ServiceError(httpError.PARENT_DOESNT_EXISTS);
    }
    const isPathOk = environment.entities
      ? isTypePathCorrect(environment.entities, xpathEntitySegments.join("/"))
      : true;
    if (!isPathOk) {
      throw new ServiceError(httpError.ENTITY_PATH);
    }
  }
  const entitiesToBeInserted = bodyEntities.map((entity) => {
    const id = generateToken(8);
    const modelAttrs = { ...entity };
    return {
      model: modelAttrs,
      id,
      type: `${appName}/${envName}/${entityTypes.join("/")}`,
      ancestors,
    };
  });
  await EnvironmentModel.findOneAndUpdate(
    { _id: environment._id },
    { $addToSet: { entities: entityTypes.join("/") } }
  );
  await EntityModel.insertMany(entitiesToBeInserted);
  return entitiesToBeInserted.map((e) => e.id);
};
