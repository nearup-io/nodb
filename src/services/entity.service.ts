import mongoose from "mongoose";
import * as R from "ramda";
import EntityModel, { type Entity } from "../models/entity.model";
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
  getPaginationDbQuery,
  type SortBy,
  entityMetaResponse,
} from "../utils/entity-utils";
import { ServiceError } from "../utils/service-errors";
import { findEnvironment } from "./environment.service";
import type {
  EntityRouteParams,
  EntityRequestDto,
  PostEntityRequestDto,
} from "../routes/entities.ts";

type EntityAggregateResult = {
  totalCount: number;
  entities: Entity[];
};

export const getEntities = async ({
  xpath,
  propFilters,
  metaFilters,
  rawQuery,
  routeParams: { appName, entityName, envName },
}: {
  xpath: string;
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
  rawQuery: Record<string, string>;
  routeParams: EntityRouteParams;
}): Promise<Record<string, any>> => {
  const modelFilters = toModelFilters(propFilters);
  const paginationQuery = getPaginationDbQuery({
    page: metaFilters?.page,
    perPage: metaFilters?.perPage,
  });
  console.log(paginationQuery);

  const aggregateQuery = getAggregateQuery({
    modelFilters,
    metaFilters,
    xpath,
    paginationQuery,
  });

  const fromDb = await EntityModel.aggregate<EntityAggregateResult>(
    // @ts-ignore TODO: using $sort raises "No overload matches this call"
    aggregateQuery,
  );

  const { totalCount, entities } = fromDb.at(0) || {
    entities: [],
    totalCount: 0,
  };

  if (!entities || R.isEmpty(entities)) {
    return { [entityName]: [] };
  }
  // TODO move this function to router utils
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const paginationMetadata = metaFilters.hasMeta
    ? {
        __meta: generatePaginationMetadata({
          rawQuery,
          paginationQuery,
          appName,
          envName,
          xpathEntitySegments,
          totalCount,
          entityCount: entities.length,
        }),
      }
    : undefined;

  const result = entities.map((entity) => ({
    id: entity.id,
    ...R.pick(metaFilters?.only || R.keys(entity.model), entity.model),
    __meta: entityMetaResponse({
      hasMeta: metaFilters?.hasMeta,
      xpath,
      id: entity.id,
    }),
  }));

  return {
    [entityName]: result,
    ...paginationMetadata,
  };
};

export type Pagination = {
  totalCount: number;
  items: number;
  next?: number;
  previous?: number;
  pages: number;
  page: number;
  current_page: string;
  first_page?: string;
  last_page?: string;
  previous_page?: string;
  next_page?: string;
};

const generatePaginationMetadata = ({
  rawQuery,
  appName,
  envName,
  xpathEntitySegments,
  paginationQuery: { skip, limit },
  totalCount,
  entityCount,
}: {
  xpathEntitySegments: string[];
  appName: string;
  envName: string;
  rawQuery: Record<string, string>;
  paginationQuery: { skip: number; limit: number };
  totalCount: number;
  entityCount: number;
}): Pagination => {
  const queries = { ...rawQuery };
  delete queries["__per_page"];
  delete queries["__page"];

  const addQueries = !R.isEmpty(queries)
    ? `&${new URLSearchParams(queries).toString()}`
    : "";

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = skip / limit + 1;
  const nextPage = currentPage + 1 > totalPages ? undefined : currentPage + 1;
  const previousPage = currentPage - 1 < 1 ? undefined : currentPage - 1;

  const baseUrl = `/${appName}/${envName}/${xpathEntitySegments.join("/")}`;
  return {
    totalCount,
    items: entityCount,
    next: totalPages > 1 ? nextPage : undefined,
    previous: previousPage,
    pages: totalPages,
    page: currentPage,
    first_page:
      totalPages > 1
        ? `${baseUrl}?__page=1&__per_page=${limit}${addQueries}`
        : undefined,
    last_page:
      totalPages > 1
        ? `${baseUrl}?__page=${totalPages}&__per_page=${limit}${addQueries}`
        : undefined,
    next_page: R.isNil(nextPage)
      ? undefined
      : `${baseUrl}?__page=${nextPage}&__per_page=${limit}${addQueries}`,
    previous_page:
      previousPage === undefined
        ? undefined
        : `${baseUrl}?__page=${previousPage}&__per_page=${limit}${addQueries}`,
    current_page: `${baseUrl}?__page=${currentPage}&__per_page=${limit}${addQueries}`,
  };
};

export const getSingleEntity = async ({
  xpath: { appName, envName, entityName },
  metaFilters,
  entityId,
}: {
  xpath: EntityRouteParams;
  metaFilters: EntityQueryMeta;
  entityId: string;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entity = await EntityModel.findOne({
    id: entityId,
    type: {
      $regex: new RegExp(`\\b(${appName}/${envName}/${entityName})\\b`),
    },
  });
  if (!entity) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }
  const objProps =
    metaFilters.only && Array.isArray(metaFilters.only)
      ? R.pick(metaFilters.only, entity.model)
      : entity.model;
  const xpath = `/${appName}/${envName}/${entityName}/${entityId}`;
  return {
    id: entity.id,
    ...objProps,
    __meta: !metaFilters.hasMeta
      ? undefined
      : {
          self: xpath,
          subtypes: environment.entities
            ?.filter((x) => x !== entityName && x.includes(`${entityName}/`))
            .reduce<Record<string, string>>((acc, curr) => {
              const subEntityName = R.replace(`${entityName}/`, "", curr);
              acc[subEntityName] = `${xpath}/${subEntityName}`;
              return acc;
            }, {}),
        },
  };
};

export const createOrOverwriteEntities = async ({
  appName,
  envName,
  xpath,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpath: string;
  bodyEntities: PostEntityRequestDto[];
}) => {
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
    await throwIfNoParent(parentIdFromXpath);
    const isPathOk = environment.entities
      ? isTypePathCorrect(environment.entities, xpathEntitySegments.join("/"))
      : true;
    if (!isPathOk) {
      throw new ServiceError(httpError.ENTITY_PATH);
    }
  }

  const entitiesIdsToBeReplaced: string[] = bodyEntities
    .filter((entity) => !!entity.id)
    .map((entity) => entity.id!);

  const entitiesToBeInserted: Entity[] = bodyEntities.map((entity) => {
    const id = entity.id ?? generateToken(8);
    return {
      model: { ...entity },
      id,
      type: `${appName}/${envName}/${entityTypes.join("/")}`,
      ancestors,
    };
  });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await EntityModel.deleteMany(
      { id: { $in: entitiesIdsToBeReplaced } },
      { session },
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $addToSet: { entities: entityTypes.join("/") } },
      { session },
    );
    await EntityModel.insertMany(entitiesToBeInserted, { session });
    await session.commitTransaction();
    return entitiesToBeInserted.map((e) => e.id);
  } catch (e) {
    console.error("Error adding entities", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENTITIES_CANT_ADD);
  } finally {
    await session.endSession();
  }
};

export const deleteRootAndUpdateEnv = async ({
  appName,
  envName,
  entityName,
}: {
  appName: string;
  envName: string;
  entityName: string;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const entities = await EntityModel.deleteMany(
      {
        type: {
          $regex: new RegExp(
            `\\b(${`${appName}/${envName}/${entityName}`})\\b`,
          ),
        },
      },
      { session },
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $pull: { entities: { $regex: new RegExp(`\\b(${entityName})\\b`) } } },
      { session },
    );
    await session.commitTransaction();
    return { done: entities.deletedCount };
  } catch (e) {
    console.error("Error deleting entities", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENTITIES_CANT_DELETE);
  } finally {
    await session.endSession();
  }
};

export const deleteSubEntitiesAndUpdateEnv = async ({
  appName,
  envName,
  xpath,
}: {
  appName: string;
  envName: string;
  xpath: string;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0,
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0,
  );
  const entityTypeRegex = `\\b(${appName}/${envName}/${entityTypes.join("/")})\\b`;
  const envEntityTypeRegex = `\\b(${entityTypes.join("/")})\\b`;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const entities = await EntityModel.deleteMany(
      {
        ancestors: { $all: ancestors },
        type: {
          $regex: new RegExp(entityTypeRegex),
        },
      },
      { session },
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $pull: { entities: { $regex: envEntityTypeRegex } } },
      { session },
    );
    await session.commitTransaction();
    return { done: entities.deletedCount };
  } catch (e) {
    console.error("Error deleting entities", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENTITIES_CANT_DELETE);
  } finally {
    await session.endSession();
  }
};

export const deleteSingleEntityAndUpdateEnv = async ({
  appName,
  envName,
  xpath,
}: {
  appName: string;
  envName: string;
  xpath: string;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0,
  );
  const entityId = R.last(xpathEntitySegments);
  const entity = await EntityModel.findOne({ id: entityId });
  if (entity && entity.id) {
    await EntityModel.deleteOne({ id: entityId });
    await EntityModel.deleteMany({
      ancestors: { $elemMatch: { $eq: entityId } },
    });
    // if deleted the last one of its type
    const entityCheck = await EntityModel.find({
      type: { $regex: `${appName}/${envName}/${entityTypes.join("/")}` },
    });
    if (entityCheck.length < 1) {
      await EnvironmentModel.findOneAndUpdate(
        { _id: environment._id },
        {
          $pull: {
            entities: {
              $regex: new RegExp(`\\b(${entityTypes.join("/")})\\b`),
            },
          },
        },
      );
    }
  }
  return entity;
};

export const replaceEntities = async ({
  appName,
  envName,
  xpath,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpath: string;
  bodyEntities: EntityRequestDto[];
}) => {
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0,
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0,
  );
  const documentIds = bodyEntities.filter(({ id }) => !!id).map(({ id }) => id);
  const dbExistingDocuments = await EntityModel.find({
    id: { $in: documentIds },
    type: `${appName}/${envName}/${entityTypes.join("/")}`,
    ancestors,
  });
  if (R.isEmpty(dbExistingDocuments)) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }
  const documentsToBeUpdated: Entity[] = dbExistingDocuments.map((entity) => {
    const { id, ...propsToBeReplaced } = bodyEntities.find(
      (x) => x.id === entity.id,
    )!;
    return {
      id: entity.id,
      model: { ...propsToBeReplaced },
      type: entity.type,
      ancestors: entity.ancestors,
    };
  });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await EntityModel.deleteMany({ id: { $in: documentIds } }, { session });
    await EntityModel.insertMany(documentsToBeUpdated, { session });
    await session.commitTransaction();
    return documentsToBeUpdated.map((e) => e.id);
  } catch (e) {
    console.error("Error updating entities", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENTITIES_CANT_UPDATE);
  } finally {
    await session.endSession();
  }
};

export const updateEntities = async ({
  appName,
  envName,
  xpath,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpath: string;
  bodyEntities: EntityRequestDto[];
}) => {
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0,
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0,
  );
  const documentIds = bodyEntities.filter(({ id }) => !!id).map(({ id }) => id);
  const dbExistingDocuments = await EntityModel.find({
    id: { $in: documentIds },
    type: `${appName}/${envName}/${entityTypes.join("/")}`,
    ancestors,
  });
  if (R.isEmpty(dbExistingDocuments)) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }
  const documentsToBeUpdated: Entity[] = dbExistingDocuments.map((entity) => {
    const { id, ...propsToBeReplaced } = bodyEntities.find(
      (x) => x.id === entity.id,
    )!;
    return {
      id: entity.id,
      model: { ...entity.model, ...propsToBeReplaced },
      type: entity.type,
      ancestors: entity.ancestors,
    };
  });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await EntityModel.deleteMany({ id: { $in: documentIds } }, { session });
    await EntityModel.insertMany(documentsToBeUpdated, { session });
    await session.commitTransaction();
    return documentsToBeUpdated.map((e) => e.id);
  } catch (e) {
    console.error("Error updating entities", e);
    await session.abortTransaction();
    throw new ServiceError(httpError.ENTITIES_CANT_UPDATE);
  } finally {
    await session.endSession();
  }
};
