import mongoose from "mongoose";
import * as R from "ramda";
import EntityModel, { type Entity } from "../models/entity.model";
import EnvironmentModel from "../models/environment.model";
import {
  getAnthropicMessage,
  getEmbedding,
  getOpenaiCompletion,
} from "../utils/ai-utils.ts";
import generateToken from "../utils/backend-token";
import { httpError, llms } from "../utils/const";
import {
  entityMetaResponse,
  getAggregateQuery,
  getAncestors,
  getEntityTypes,
  getPaginationNumbers,
  isTypePathCorrect,
  throwIfNoParent,
  toModelFilters,
} from "../utils/entity-utils";
import { ServiceError } from "../utils/service-errors";
import type {
  EntityQueryMeta,
  EntityRequestDto,
  EntityRouteParams,
  Pagination,
  PostEntityRequestDto,
} from "../utils/types.ts";
import { findEnvironment } from "./environment.service";

type EntityAggregateResult = {
  totalCount: number;
  entities: Entity[];
};

const { NODB_VECTOR_INDEX: vectorIndex = "nodb_vector_index" } = Bun.env;

export const searchEntities = async ({
  query,
  limit = 5,
  entityType,
}: {
  query: string;
  limit: number;
  entityType: string | null;
}) => {
  const embedding = await getEmbedding(query);
  const res = await EntityModel.aggregate([
    {
      $vectorSearch: {
        index: vectorIndex,
        path: "embedding",
        queryVector: embedding,
        numCandidates: limit * 15,
        limit,
        filter: entityType ? { type: entityType } : {},
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$$ROOT",
            "$model",
            { __meta: { score: { $meta: "vectorSearchScore" } } },
          ],
        },
      },
    },
    { $unset: ["_id", "ancestors", "model", "type", "embedding", "__v"] },
  ]);
  return res;
};

export const searchAiEntities = async ({
  query,
  limit = 5,
  entityType,
}: {
  query: string;
  limit: number;
  entityType: string | null;
}) => {
  const embedding = await getEmbedding(query);
  try {
    const res = await EntityModel.aggregate([
      {
        $vectorSearch: {
          index: vectorIndex,
          path: "embedding",
          queryVector: embedding,
          numCandidates: limit * 15,
          limit,
          filter: entityType ? { type: entityType } : {},
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$$ROOT",
              "$model",
              { meta: { score: { $meta: "vectorSearchScore" } } },
            ],
          },
        },
      },
      { $unset: ["_id", "ancestors", "model", "type", "embedding", "__v"] },
    ]);
    const context = res.map((obj) => JSON.stringify(obj)).join(" ");
    let completion = null;
    try {
      switch (Bun.env.AI_PROVIDER) {
        default:
          completion = await getOpenaiCompletion({
            query,
            context,
          });
          return { answer: completion?.choices[0].message.content };
        case llms.anthropic:
          completion = await getAnthropicMessage({
            query,
            context,
          });
          return { answer: completion?.content[0] };
      }
    } catch (e) {
      if (e instanceof Error) {
        throw new ServiceError(e.message);
      }
    }
  } catch (e) {
    console.error(e);
    if (e instanceof Error) {
      throw new ServiceError(httpError.UNKNOWN);
    }
  }
};

export const getEntities = async ({
  xpathEntitySegments,
  propFilters,
  metaFilters,
  rawQuery,
  routeParams: { appName, entityName, envName },
}: {
  xpathEntitySegments: string[];
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
  rawQuery: Record<string, string>;
  routeParams: EntityRouteParams;
}): Promise<Record<string, any>> => {
  const modelFilters = toModelFilters(propFilters);
  const paginationQuery = getPaginationNumbers({
    page: metaFilters?.page,
    perPage: metaFilters?.perPage,
  });
  const aggregateQuery = getAggregateQuery({
    modelFilters,
    metaFilters,
    paginationQuery,
    appName,
    envName,
    xpathEntitySegments,
  });
  const fromDb = await EntityModel.aggregate<EntityAggregateResult>(
    // @ts-ignore TODO: using $sort raises "No overload matches this call"
    aggregateQuery
  );
  const { totalCount, entities } = fromDb.at(0) || {
    entities: [],
    totalCount: 0,
  };
  if (!entities || R.isEmpty(entities)) {
    return { [entityName]: [] };
  }
  // TODO move this function to router utils
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
      xpathEntitySegments,
      appName,
      envName,
      id: entity.id,
    }),
  }));
  return {
    [entityName]: result,
    ...paginationMetadata,
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
  xpathEntitySegments,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpathEntitySegments: string[];
  bodyEntities: PostEntityRequestDto[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const parentIdFromXpath = R.nth(-2, xpathEntitySegments);
  const entityTypes = getEntityTypes(xpathEntitySegments);
  const ancestors = getAncestors(xpathEntitySegments);
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
  const insertEntities: Entity[] = [];
  for (let bodyEntity of bodyEntities) {
    const embeddingInput = {
      ...bodyEntity,
      __vector_title: R.last(entityTypes),
    };
    const input = JSON.stringify(embeddingInput);
    const embedding = await getEmbedding(input);
    const id = bodyEntity.id ?? generateToken(8);
    const entityWithoutId = R.omit(["id"], bodyEntity);
    insertEntities.push({
      id,
      model: { ...entityWithoutId },
      type: `${appName}/${envName}/${entityTypes.join("/")}`,
      ancestors,
      embedding,
    });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await EntityModel.deleteMany(
      { id: { $in: entitiesIdsToBeReplaced } },
      { session }
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $addToSet: { entities: entityTypes.join("/") } },
      { session }
    );
    await EntityModel.insertMany(insertEntities, { session });
    await session.commitTransaction();
    return insertEntities.map((e) => e.id);
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
            `\\b(${`${appName}/${envName}/${entityName}`})\\b`
          ),
        },
      },
      { session }
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $pull: { entities: { $regex: new RegExp(`\\b(${entityName})\\b`) } } },
      { session }
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
  xpathEntitySegments,
}: {
  appName: string;
  envName: string;
  xpathEntitySegments: string[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0
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
      { session }
    );
    await EnvironmentModel.findOneAndUpdate(
      { _id: environment._id },
      { $pull: { entities: { $regex: envEntityTypeRegex } } },
      { session }
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
  xpathEntitySegments,
}: {
  appName: string;
  envName: string;
  xpathEntitySegments: string[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0
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
        }
      );
    }
  }
  return entity;
};

export const replaceEntities = async ({
  appName,
  envName,
  xpathEntitySegments,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpathEntitySegments: string[];
  bodyEntities: EntityRequestDto[];
}) => {
  const entityTypes = getEntityTypes(xpathEntitySegments);
  const ancestors = getAncestors(xpathEntitySegments);
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
      (x) => x.id === entity.id
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
  xpathEntitySegments,
  bodyEntities,
}: {
  appName: string;
  envName: string;
  xpathEntitySegments: string[];
  bodyEntities: EntityRequestDto[];
}) => {
  const entityTypes = getEntityTypes(xpathEntitySegments);
  const ancestors = getAncestors(xpathEntitySegments);
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
      (x) => x.id === entity.id
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
  const queries = R.omit(["__per_page", "__page"], rawQuery);

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
