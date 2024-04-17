import mongoose from "mongoose";
import OpenAI from "openai";
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
} from "../utils/entity-utils";
import { ServiceError } from "../utils/service-errors";
import { findEnvironment } from "./environment.service";

const openai = new OpenAI({
  apiKey: Bun.env.OPENAI_KEY,
});

type EntityAggregateResult = {
  totalCount: number;
  entities: Entity[];
};

const {
  NODB_VECTOR_INDEX: vectorIndex = "nodb_vector_index",
  NODB_VECTOR_PATH: vectorPath = "embedding",
} = Bun.env;

export const searchEntities = async (query: string) => {
  const embedding = await openai.embeddings.create({
    model: Bun.env.ENTITY_MODEL || "text-embedding-ada-002",
    input: query,
    encoding_format: "float",
  });
  const res = await EntityModel.aggregate([
    {
      $vectorSearch: {
        index: vectorIndex,
        path: vectorPath,
        queryVector: embedding.data[0].embedding,
        numCandidates: 150,
        limit: 10,
      },
    },
    {
      $project: {
        _id: 0,
        model: 1,
        score: {
          $meta: "vectorSearchScore",
        },
      },
    },
  ]);
  return res;
};

export const getEntities = async ({
  xpath,
  propFilters,
  metaFilters,
}: {
  xpath: string;
  propFilters: Record<string, unknown>;
  metaFilters: EntityQueryMeta;
}): Promise<EntityAggregateResult[]> => {
  const modelFilters = toModelFilters(propFilters);
  const aggregateQuery = getAggregateQuery({
    modelFilters,
    metaFilters,
    xpath,
  });
  const fromDb = await EntityModel.aggregate<EntityAggregateResult>(
    // @ts-ignore TODO: using $sort raises "No overload matches this call"
    aggregateQuery
  );
  return fromDb;
};

export const getSingleEntity = async ({
  xPath: { appName, envName, entityName },
  metaFilters,
  entityId,
}: {
  xPath: { appName: string; envName: string; entityName: string };
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
  const xPath = `/${appName}/${envName}/${entityName}/${entityId}`;
  return {
    id: entity.id,
    ...objProps,
    __meta: !metaFilters.hasMeta
      ? undefined
      : {
          self: xPath,
          subtypes: environment.entities
            ?.filter((x) => x !== entityName && x.includes(`${entityName}/`))
            .reduce<Record<string, string>>((acc, curr) => {
              const subEntityName = R.replace(`${entityName}/`, "", curr);
              acc[subEntityName] = `${xPath}/${subEntityName}`;
              return acc;
            }, {}),
        },
  };
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
  bodyEntities: Omit<Entity, "id">[];
}) => {
  const environment = await findEnvironment({
    appName,
    envName,
  });
  if (!environment) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST);
  }
  const xpath = R.isEmpty(restSegments)
    ? `${appName}/${envName}/${entityName}`
    : `${appName}/${envName}/${entityName}/${restSegments.join("/")}`;
  const xpathEntitySegments = getXpathSegments(xpath) as string[];
  const parentIdFromXpath = R.nth(-2, xpathEntitySegments);
  const entityTypes = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 === 0
  );
  const ancestors = xpathEntitySegments.filter(
    (_: any, i: number) => i % 2 !== 0
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
  const insertEntities = [];
  for (let bodyEntity of bodyEntities) {
    const embedding = await openai.embeddings.create({
      model: Bun.env.ENTITY_MODEL || "text-embedding-ada-002",
      input: JSON.stringify(bodyEntity),
      encoding_format: "float",
    });
    const id = generateToken(8);
    insertEntities.push({
      model: { ...bodyEntity },
      id,
      type: `${appName}/${envName}/${entityTypes.join("/")}`,
      ancestors,
      embedding: embedding.data[0].embedding,
    });
  }
  await EnvironmentModel.findOneAndUpdate(
    { _id: environment._id },
    { $addToSet: { entities: entityTypes.join("/") } }
  );
  await EntityModel.insertMany(insertEntities);
  return insertEntities.map((e) => e.id);
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
