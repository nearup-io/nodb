import * as R from "ramda";
import EntityModel, { type IEntity } from "../models/entity.model";
import EnvironmentModel from "../models/environment.model";
import generateToken from "../utils/backend-token";
import { httpError } from "../utils/const";
import {
  getAggregateQuery,
  getXpathSegments,
  isTypePathCorrect,
  throwIfNoParent,
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
    aggregateQuery,
  );
  const entities = R.path(["entities"], R.head(entitiesAggregationResponse));
  return entities;
};

export const createOrOverwriteEntities = async ({
  appName,
  envName,
  entityName,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  entityName: string;
  bodyEntities: Omit<IEntity, "id">[];
}) => {
  const xpath = `${appName}/${envName}/${entityName}`;
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const parentIdFromXpath = R.nth(-2, xpathEntitySegments);
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0,
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0,
  );
  if (xpathEntitySegments.length > 1 && parentIdFromXpath) {
    throwIfNoParent(parentIdFromXpath);
    const isPathOk = environment.entities
      ? isTypePathCorrect(environment.entities, xpathEntitySegments.join("/"))
      : true;
    if (!isPathOk) {
      throw new ServiceError(httpError.ENTITY_PATH);
    }
  }
  const entitiesToBeInserted = bodyEntities.map((entity) => {
    const id = generateToken(8);
    return {
      model: { ...entity },
      id,
      type: `${appName}/${envName}/${entityTypes.join("/")}`,
      ancestors,
    };
  });
  await EnvironmentModel.findOneAndUpdate(
    { _id: environment._id },
    { $addToSet: { entities: entityTypes.join("/") } },
  );
  await EntityModel.insertMany(entitiesToBeInserted);
  return entitiesToBeInserted.map((e) => e.id);
};

export const getSingleEntity = async ({
  xPath: { appName, envName, entityName },
  propFilters,
  metaFilters,
  entityId,
}: {
  xPath: { appName: string; envName: string; entityName: string };
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
  entityId: string;
}) => {
  const modelFilters = toModelFilters(propFilters);
  console.log(entityId);
  console.log(propFilters);
  console.log(metaFilters);

  const entity = await EntityModel.findOne({
    id: entityId,
    type: {
      $regex: new RegExp(`\\b(${appName}/${envName}/${entityName})\\b`),
    },
  });

  if (!entity) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }

  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }

  console.log(environment);

  return {
    id: entity.id,
    // TODO  modelFilters
    // ...R.pick(modelFilters, entity),
    __meta: !metaFilters.hasMeta
      ? undefined
      : {
          self: `/${appName}/${envName}/${entityName}`,
          subtypes: environment.entities!.filter((x) => x !== entityName),
        },
  };
};
