import mongoose from "mongoose";
import BaseRepository from "./base-repository.ts";
import { type Entity } from "../../models/entity.model.ts";
import { ObjectId } from "mongodb";

class EntityRepository extends BaseRepository {
  constructor(readonly conn: mongoose.Connection) {
    super(conn);
  }

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

  public async findEntitiesByIdsTypeAndAncestors({
    ids,
    ancestors,
    type,
  }: {
    ids: string[];
    type: string;
    ancestors: string[];
  }): Promise<Entity[]> {
    return this.entityModel.find({
      id: { $in: ids },
      type,
      ancestors,
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
            $regex: new RegExp(
              `\\b(${`${appName}/${envName}/${entityName}`})\\b`,
            ),
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
    const entity = await this.entityModel.findOne({ id: entityId });
    if (!entity) return null;

    await this.transaction(async (session) => {
      await this.entityModel.deleteOne({ id: entityId }, { session });
      await this.entityModel.deleteMany(
        {
          ancestors: { $elemMatch: { $eq: entityId } },
        },
        { session },
      );
      // if deleted the last one of its type
      const entityCheck = await this.entityModel.find({
        type: { $regex: `${appName}/${envName}/${entityTypes.join("/")}` },
      });
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
    });

    return entity;
  }
}

export default EntityRepository;
