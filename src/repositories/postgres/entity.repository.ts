import BaseRepository from "./base.repository.ts";
import type { IEntityRepository } from "../interfaces.ts";
import type { EntityQueryMeta, SortBy } from "../../utils/types.ts";
import type { PipelineStage } from "mongoose";
import * as R from "ramda";
import type { EntityAggregateResult } from "../../services/entity.service.ts";
import { type Entity } from "../../models/entity.model.ts";
import { Prisma, type PrismaClient } from "@prisma/client";
import pgvector from "pgvector";
import { Sql } from "@prisma/client/runtime/library";

class EntityRepository extends BaseRepository implements IEntityRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  private generateInsertSql(entities: Entity[], environmentId: string): Sql {
    const values = entities.map((entity) => {
      const id = Prisma.sql`${entity.id}`;
      const model = Prisma.sql`${JSON.stringify(entity.model)}`;
      const ancestors = entity.ancestors?.length
        ? Prisma.sql`{${Prisma.join(entity.ancestors)}}`
        : Prisma.sql`{}`;
      const extras = entity.extras
        ? Prisma.sql`${JSON.stringify(entity.extras)}`
        : null;
      const embedding = entity.embedding
        ? Prisma.sql`${pgvector.toSql(entity.embedding)}::vector`
        : null;

      return Prisma.sql`(${id}, ${entity.type}, ${model}, ${ancestors}, ${environmentId}, ${extras}, ${embedding})`;
    });

    return Prisma.sql`INSERT INTO Entity (id, type, model, ancestors, environmentId, extras, embedding) VALUES
    ${Prisma.join(values)}
    RETURNING id`;
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
    parentId,
    ancestors,
    entityTypes,
  }: {
    modelFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    parentId?: string;
    ancestors: string[];
    entityTypes: string[];
  }): PipelineStage[] => {
    throw new Error("method not implemented");
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
    const entity = await this.prisma.entity.findFirst({
      where: {
        id: entityId,
        type: {
          // TODO why do we need the type here?
          // ids should be unique,
          startsWith: `${appName}/${envName}/${entityTypes.join("/")}`,
        },
      },
    });
    if (!entity) return null;
    return {
      id: entity.id,
      type: entity.type,
      model: entity.model as Record<string, unknown>,
      extras: entity.extras
        ? (entity.extras as Record<string, unknown>)
        : undefined,
      ancestors: entity.ancestors,
    };
  }

  public async getEntities({
    propFilters,
    metaFilters,
    paginationQuery,
    appName,
    envName,
    parentId,
    ancestors,
    entityTypes,
  }: {
    propFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    parentId?: string;
    ancestors: string[];
    entityTypes: string[];
  }): Promise<EntityAggregateResult[]> {
    throw new Error("method not implemented");
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
  }): Promise<Entity[]> {
    throw new Error("method not implemented");
  }

  public async findEntitiesByIdsTypeAndAncestors({
    ids,
    ancestors,
    type,
  }: {
    ids: string[];
    type: string;
    ancestors: string[];
  }): Promise<Omit<Entity, "embedding">[]> {
    const entities = await this.prisma.entity.findMany({
      where: {
        id: { in: ids },
        ancestors: {
          // TODO verify that hasEvery is what we need here
          hasEvery: ancestors,
        },
        type,
      },
    });
    return entities.map((entity) => {
      return {
        id: entity.id,
        type: entity.type,
        model: entity.model as Record<string, unknown>,
        extras: entity.extras
          ? (entity.extras as Record<string, unknown>)
          : undefined,
        ancestors: entity.ancestors,
      };
    });
  }

  public async createOrOverwriteEntities({
    dbEnvironmentId,
    insertEntities,
    entitiesIdsToBeReplaced,
  }: {
    entityTypes: string[];
    dbEnvironmentId: string;
    insertEntities: Entity[];
    entitiesIdsToBeReplaced: string[];
  }): Promise<string[]> {
    return this.transaction(async (prisma) => {
      await prisma.entity.deleteMany({
        where: { id: { in: entitiesIdsToBeReplaced } },
      });

      const result = await prisma.$queryRaw<{ id: string }[]>(
        this.generateInsertSql(insertEntities, dbEnvironmentId),
      );

      return result.map((e) => e.id);
    });
  }

  public async replaceEntities({
    entitiesToBeInserted,
    ids,
  }: {
    ids: string[];
    entitiesToBeInserted: Entity[];
  }): Promise<string[]> {
    return this.transaction<string[]>(async (prisma) => {
      const environmentId = (await prisma.environment.findFirst({
        where: {
          entities: {
            some: {
              id: ids.at(0),
            },
          },
        },
        select: {
          id: true,
        },
      }))!.id;
      await prisma.entity.deleteMany({ where: { id: { in: ids } } });

      const result = await prisma.$queryRaw<{ id: string }[]>(
        this.generateInsertSql(entitiesToBeInserted, environmentId),
      );

      return result.map((e) => e.id);
    });
  }

  public async deleteRootAndUpdateEnv({
    appName,
    envName,
    entityName,
  }: {
    appName: string;
    envName: string;
    entityName: string;
    dbEnvironmentId: string;
  }): Promise<{ done: number }> {
    const deleted = await this.prisma.entity.deleteMany({
      where: {
        type: {
          startsWith: `${appName}/${envName}/${entityName}`,
        },
      },
    });

    return { done: deleted.count };
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
    // TODO this method should be removed as we don't want to support sub entities
    throw new Error("method not implemented");
  }

  public async deleteSingleEntityAndUpdateEnv({
    entityId,
  }: {
    entityId: string;
    appName: string;
    envName: string;
    entityTypes: string[];
    dbEnvironmentId: string;
  }): Promise<Entity | null> {
    const entity = await this.prisma.entity.delete({
      where: {
        id: entityId,
      },
    });
    if (!entity) return null;

    return {
      ...entity,
      model: entity.model as Record<string, unknown>,
      extras: entity.extras as Record<string, unknown>,
    };
  }
}

export default EntityRepository;
