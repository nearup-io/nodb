import { type PipelineStage } from "mongoose";
import BaseRepository from "./base.repository.ts";
import { type Entity } from "../../models/entity.model.ts";
import { ObjectId } from "mongodb";
import type { EntityQueryMeta, SortBy } from "../../utils/types.ts";
import * as R from "ramda";
import type { EntityAggregateResult } from "../../services/entity.service.ts";
import type { IEntityRepository } from "../interfaces.ts";

class EntityRepository extends BaseRepository implements IEntityRepository {
  constructor() {
    super();
  }

  private getSortDbQuery = (
    sortBy: SortBy[] | undefined,
  ): PipelineStage.Sort | undefined => {
    if (!sortBy || R.isEmpty(sortBy)) {
      return;
    }
    const initObj: Record<string, 1 | -1> = {};
    const sort = sortBy.reduce((acc, cur) => {
      if (!acc[`model.${cur.name}`]) {
        acc[`model.${cur.name}`] = cur.order === "asc" ? 1 : -1;
      }
      return acc;
    }, initObj);
    return { $sort: sort };
  };

  private toModelFilters(
    filters: Record<string, unknown>,
  ): Record<string, unknown> {
    // {
    //   "foo": "bar" -> "model.foo": "bar"
    //   "baz": "bux" -> "model.baz": "bux"
    // }
    const filtersKeys = R.keys(filters);
    return filtersKeys
      .map((k: string) => {
        return { [`model.${k}`]: filters[k] };
      })
      .reduce((acc, cur) => {
        acc[R.keys(cur)[0]] = R.values(cur)[0];
        return acc;
      }, {});
  }

  private getAggregateQuery = ({
    modelFilters,
    metaFilters,
    paginationQuery: { skip, limit },
    appName,
    envName,
    entityTypes,
  }: {
    modelFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    entityTypes: string[];
  }): PipelineStage[] => {
    const paginationQuery = [{ $skip: skip }, { $limit: limit }];
    const sortQuery = this.getSortDbQuery(metaFilters?.sortBy);
    const stage2 = !!sortQuery
      ? [sortQuery, ...paginationQuery]
      : [...paginationQuery];
    return [
      {
        $match: {
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

  public async getSingleEntity({
    entityId,
    entityTypes,
    appName,
    envName,
  }: {
    entityId: string;
    entityTypes: string[];
    appName: string;
    envName: string;
  }): Promise<Entity | null> {
    return this.entityModel.findOne({
      id: entityId,
      type: {
        $regex: new RegExp(
          `\\b(${appName}/${envName}/${entityTypes.join("/")})\\b`,
        ),
      },
    });
  }

  public async getEntities({
    propFilters,
    metaFilters,
    paginationQuery,
    appName,
    envName,
    entityTypes,
  }: {
    propFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    entityTypes: string[];
  }): Promise<EntityAggregateResult> {
    const modelFilters = this.toModelFilters(propFilters);
    const aggregateQuery = this.getAggregateQuery({
      modelFilters,
      metaFilters,
      entityTypes,
      paginationQuery,
      appName,
      envName,
    });

    const result =
      await this.entityModel.aggregate<EntityAggregateResult>(aggregateQuery);
    return result[0] ? result[0] : { totalCount: 0, entities: [] };
  }

  public async searchEntities({
    embedding,
    vectorIndex,
    limit,
    entityType,
  }: {
    embedding: number[];
    vectorIndex: string;
    limit: number;
    entityType?: string;
  }): Promise<Record<string, unknown>[]> {
    return this.entityModel.aggregate<Record<string, unknown>>([
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
  }

  public async findEntitiesByIdsType({
    ids,
    type,
  }: {
    ids: string[];
    type: string;
  }): Promise<Omit<Entity, "embedding">[]> {
    return this.entityModel.find({
      id: { $in: ids },
      type,
    });
  }

  public async createOrOverwriteEntities({
    entityTypes,
    dbEnvironmentId,
    insertEntities,
    entitiesIdsToBeReplaced,
  }: {
    entityTypes: string[];
    dbEnvironmentId: string;
    insertEntities: Entity[];
    entitiesIdsToBeReplaced: string[];
  }): Promise<string[]> {
    return this.transaction(async (session) => {
      await this.entityModel.deleteMany(
        { id: { $in: entitiesIdsToBeReplaced } },
        { session },
      );
      await this.environmentModel.findOneAndUpdate(
        { _id: new ObjectId(dbEnvironmentId) },
        { $addToSet: { entities: entityTypes.join("/") } },
        { session },
      );
      await this.entityModel.insertMany(insertEntities, { session });

      return insertEntities.map((e) => e.id);
    });
  }

  public async replaceEntities({
    entitiesToBeInserted,
    ids,
  }: {
    ids: string[];
    entitiesToBeInserted: Entity[];
  }): Promise<string[]> {
    return this.transaction<string[]>(async (session) => {
      await this.entityModel.deleteMany({ id: { $in: ids } }, { session });
      await this.entityModel.insertMany(entitiesToBeInserted, { session });
      await session.commitTransaction();
      return entitiesToBeInserted.map((e) => e.id);
    });
  }

  public async deleteRootAndUpdateEnv({
    appName,
    envName,
    entityName,
    dbEnvironmentId,
  }: {
    appName: string;
    envName: string;
    entityName: string;
    dbEnvironmentId: string;
  }): Promise<{ done: number }> {
    return this.transaction<{ done: number }>(async (session) => {
      const entities = await this.entityModel.deleteMany(
        {
          type: {
            $regex: new RegExp(`\\b(${appName}/${envName}/${entityName})\\b`),
          },
        },
        { session },
      );
      await this.environmentModel.findOneAndUpdate(
        { _id: new ObjectId(dbEnvironmentId) },
        {
          $pull: { entities: { $regex: new RegExp(`\\b(${entityName})\\b`) } },
        },
        { session },
      );
      return { done: entities.deletedCount };
    });
  }

  public async deleteSubEntitiesAndUpdateEnv({
    ancestors,
    appName,
    envName,
    entityTypes,
    dbEnvironmentId,
  }: {
    appName: string;
    envName: string;
    entityTypes: string[];
    ancestors: string[];
    dbEnvironmentId: string;
  }): Promise<{ done: number }> {
    return this.transaction<{ done: number }>(async (session) => {
      const entities = await this.entityModel.deleteMany(
        {
          ancestors: { $all: ancestors },
          type: {
            $regex: new RegExp(
              `\\b(${appName}/${envName}/${entityTypes.join("/")})\\b`,
            ),
          },
        },
        { session },
      );
      await this.environmentModel.findOneAndUpdate(
        { _id: new ObjectId(dbEnvironmentId) },
        {
          $pull: {
            entities: {
              $regex: new RegExp(`\\b(${entityTypes.join("/")})\\b`),
            },
          },
        },
        { session },
      );
      return { done: entities.deletedCount };
    });
  }

  public async deleteSingleEntityAndUpdateEnv({
    entityId,
    appName,
    entityTypes,
    envName,
    dbEnvironmentId,
  }: {
    entityId: string;
    appName: string;
    envName: string;
    entityTypes: string[];
    dbEnvironmentId: string;
  }): Promise<Entity | null> {
    return this.transaction<Entity | null>(async (session) => {
      const entity = await this.entityModel.findOne({ id: entityId });
      if (!entity) return null;
      await this.entityModel.deleteOne({ id: entityId }, { session });
      await this.entityModel.deleteMany(
        {
          ancestors: { $elemMatch: { $eq: entityId } },
        },
        { session },
      );
      // if deleted the last one of its type
      const entityCheck = await this.entityModel.find(
        {
          type: { $regex: `${appName}/${envName}/${entityTypes.join("/")}` },
        },
        null,
        { session },
      );
      if (entityCheck.length < 1) {
        await this.environmentModel.findOneAndUpdate(
          { _id: new ObjectId(dbEnvironmentId) },
          {
            $pull: {
              entities: {
                $regex: new RegExp(`\\b(${entityTypes.join("/")})\\b`),
              },
            },
          },
          { session },
        );
      }

      return entity;
    });
  }
}

export default EntityRepository;
