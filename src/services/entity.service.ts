import * as R from "ramda";
import { type Entity } from "../models/entity.model";
import {
  getAnthropicMessage,
  getEmbedding,
  getOpenaiCompletion,
} from "../utils/ai-utils.ts";
import generateToken from "../utils/backend-token";
import { ENTITY_REPOSITORY, httpError, llms } from "../utils/const";
import {
  entityMetaResponse,
  getPaginationNumbers,
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
import type Context from "../middlewares/context.ts";
import { type IEntityRepository } from "../repositories/interfaces.ts";

export type EntityAggregateResult = {
  totalCount: number;
  entities: Entity[];
};

const { NODB_VECTOR_INDEX: vectorIndex = "nodb_vector_index" } = Bun.env;

const searchEntities = async ({
  context,
  query,
  limit = 5,
  entityType,
}: {
  context: Context;
  query: string;
  limit?: number;
  entityType?: string;
}) => {
  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);
  const embedding = await getEmbedding(query);

  return entityRepository.searchEntities({
    embedding,
    entityType,
    limit,
    vectorIndex,
  });
};

const searchAiEntities = async ({
  context,
  query,
  limit = 5,
  entityType,
}: {
  context: Context;
  query: string;
  limit?: number;
  entityType?: string;
}) => {
  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);

  const embedding = await getEmbedding(query);
  try {
    const res = await entityRepository.searchEntities({
      embedding,
      limit,
      vectorIndex,
      entityType,
    });

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
  context,
  propFilters,
  metaFilters,
  rawQuery,
  routeParams: { appName, envName, entityName },
}: {
  context: Context;
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
  rawQuery: Record<string, string>;
  routeParams: EntityRouteParams;
}): Promise<Record<string, any>> => {
  const paginationQuery = getPaginationNumbers({
    page: metaFilters?.page,
    perPage: metaFilters?.perPage,
  });

  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);

  const fromDb = await entityRepository.getEntities({
    propFilters,
    metaFilters,
    entityName,
    appName,
    envName,
    paginationQuery,
  });

  const { totalCount, entities } = fromDb;
  if (!entities || R.isEmpty(entities)) {
    return { [entityName]: [] };
  }

  const paginationMetadata = {
    __meta: generatePaginationMetadata({
      rawQuery,
      paginationQuery,
      appName,
      envName,
      entityName,
      totalCount,
      entityCount: entities.length,
    }),
  };

  const result = entities.map((entity) => ({
    id: entity.id,
    ...R.pick(metaFilters?.only || R.keys(entity.model), entity.model),
    __meta: entityMetaResponse({
      hasMeta: metaFilters?.hasMeta,
      entityName,
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

const getSingleEntity = async ({
  context,
  requestParams: { appName, envName, entityName, entityId },
  metaFilters,
  xpath,
}: {
  context: Context;
  xpath: string;
  requestParams: EntityRouteParams & { entityId: string };
  metaFilters: EntityQueryMeta;
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
    context,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);
  const entity = await entityRepository.getSingleEntity({
    entityId,
    appName,
    envName,
    entityName,
  });
  if (!entity) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }
  const objProps =
    metaFilters.only && Array.isArray(metaFilters.only)
      ? R.pick(metaFilters.only, entity.model)
      : entity.model;

  return {
    id: entity.id,
    ...objProps,
    __meta: !metaFilters.hasMeta
      ? undefined
      : {
          self: xpath.replace("/apps", ""),
        },
  };
};

const createOrOverwriteEntities = async ({
  context,
  appName,
  envName,
  entityName,
  bodyEntities,
}: {
  context: Context;
  appName: string;
  envName: string;
  entityName: string;
  bodyEntities: PostEntityRequestDto[];
}): Promise<string[]> => {
  const environment = await findEnvironment({
    appName,
    envName,
    context,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entitiesIdsToBeReplaced: string[] = bodyEntities
    .filter((entity) => !!entity.id)
    .map((entity) => entity.id!);
  const insertEntities: Entity[] = [];
  for (let bodyEntity of bodyEntities) {
    const embeddingInput = {
      ...bodyEntity,
      __vector_title: entityName,
    };
    const input = JSON.stringify(embeddingInput);
    const embedding = await getEmbedding(input);
    const id = bodyEntity.id ?? generateToken(8);
    const entityWithoutId = R.omit(["id"], bodyEntity);
    insertEntities.push({
      id,
      model: { ...entityWithoutId },
      type: `${appName}/${envName}/${entityName}`,
      embedding,
    });
  }

  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);

  try {
    return await entityRepository.createOrOverwriteEntities({
      entitiesIdsToBeReplaced,
      entityName,
      dbEnvironmentId: environment.id,
      insertEntities,
    });
  } catch (e) {
    console.error("Error adding entities", e);
    throw new ServiceError(httpError.ENTITIES_CANT_ADD);
  }
};

const deleteRootAndUpdateEnv = async ({
  context,
  appName,
  envName,
  entityName,
}: {
  context: Context;
  appName: string;
  envName: string;
  entityName: string;
}): Promise<{ done: number }> => {
  const environment = await findEnvironment({
    context,
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);

  try {
    return entityRepository.deleteRootAndUpdateEnv({
      appName,
      envName,
      entityName,
      dbEnvironmentId: environment.id,
    });
  } catch (e) {
    console.error("Error deleting entities", e);
    throw new ServiceError(httpError.ENTITIES_CANT_DELETE);
  }
};

const deleteSingleEntityAndUpdateEnv = async ({
  context,
  appName,
  envName,
  entityName,
  entityId,
}: {
  context: Context;
  appName: string;
  envName: string;
  entityName: string;
  entityId: string;
}): Promise<Entity | null> => {
  const environment = await findEnvironment({
    context,
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }

  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);
  try {
    return entityRepository.deleteSingleEntityAndUpdateEnv({
      appName,
      envName,
      entityName,
      entityId,
      dbEnvironmentId: environment.id,
    });
  } catch (e) {
    console.log("Error deleting entity", e);
    throw new ServiceError(httpError.ENTITIES_CANT_DELETE);
  }
};

const replaceEntities = async ({
  context,
  appName,
  envName,
  entityName,
  bodyEntities,
}: {
  context: Context;
  appName: string;
  envName: string;
  entityName: string;
  bodyEntities: EntityRequestDto[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
    context,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);

  const documentIds = bodyEntities.filter(({ id }) => !!id).map(({ id }) => id);

  const dbExistingDocuments = await entityRepository.findEntitiesByIdsType({
    ids: documentIds,
    type: `${appName}/${envName}/${entityName}`,
  });

  if (
    R.isEmpty(dbExistingDocuments) &&
    bodyEntities.filter((x) => !x.id).length === 0
  ) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }

  const entitiesToBeInserted: Entity[] = [];
  for (let bodyEntity of bodyEntities) {
    const embeddingInput = {
      ...R.omit(["id"], bodyEntity),
      __vector_title: entityName,
    };
    const input = JSON.stringify(embeddingInput);
    const embedding = await getEmbedding(input);
    const id = bodyEntity.id ?? generateToken(8);
    const entityWithoutId = R.omit(["id"], bodyEntity);
    entitiesToBeInserted.push({
      id,
      model: { ...entityWithoutId },
      type: `${appName}/${envName}/${entityName}`,
      embedding,
    });
  }

  try {
    return entityRepository.replaceEntities({
      entitiesToBeInserted,
      ids: documentIds,
    });
  } catch (e) {
    console.error("Error updating entities", e);
    throw new ServiceError(httpError.ENTITIES_CANT_UPDATE);
  }
};

const updateEntities = async ({
  context,
  appName,
  envName,
  entityName,
  bodyEntities,
}: {
  context: Context;
  appName: string;
  envName: string;
  entityName: string;
  bodyEntities: EntityRequestDto[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
    context,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }

  const entityRepository = context.get<IEntityRepository>(ENTITY_REPOSITORY);
  const documentIds = bodyEntities.filter(({ id }) => !!id).map(({ id }) => id);
  const dbExistingDocuments = await entityRepository.findEntitiesByIdsType({
    ids: documentIds,
    type: `${appName}/${envName}/${entityName}`,
  });
  if (R.isEmpty(dbExistingDocuments)) {
    throw new ServiceError(httpError.ENTITY_NOT_FOUND);
  }

  const entitiesToBeInserted: Entity[] = [];

  for (let entity of dbExistingDocuments) {
    const { id, ...propsToBeReplaced } = bodyEntities.find(
      (x) => x.id === entity.id,
    )!;
    const embeddingInput = {
      ...{ ...entity.model, ...propsToBeReplaced },
      __vector_title: entityName,
    };
    const input = JSON.stringify(embeddingInput);
    const embedding = await getEmbedding(input);

    entitiesToBeInserted.push({
      id: entity.id,
      model: { ...entity.model, ...propsToBeReplaced },
      type: entity.type,
      embedding,
    });
  }

  try {
    return entityRepository.replaceEntities({
      entitiesToBeInserted,
      ids: documentIds,
    });
  } catch (e) {
    console.error("Error updating entities", e);
    throw new ServiceError(httpError.ENTITIES_CANT_UPDATE);
  }
};

const generatePaginationMetadata = ({
  rawQuery,
  appName,
  envName,
  entityName,
  paginationQuery: { skip, limit },
  totalCount,
  entityCount,
}: {
  entityName: string;
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

  const baseUrl = `/${appName}/${envName}/${entityName}`;
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

export {
  getSingleEntity,
  createOrOverwriteEntities,
  replaceEntities,
  updateEntities,
  deleteRootAndUpdateEnv,
  deleteSingleEntityAndUpdateEnv,
  searchEntities,
  searchAiEntities,
};
