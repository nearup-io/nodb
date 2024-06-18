import BaseRepository from "./base.repository.ts";
import type { IEntityRepository } from "../interfaces.ts";
import type { EntityQueryMeta } from "../../utils/types.ts";
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
      const model = Prisma.sql`${entity.model}`;
      const ancestors = entity.ancestors?.length
        ? Prisma.sql`'{${Prisma.join(entity.ancestors)}}'`
        : Prisma.sql`'{}'`;
      const extras = entity.extras ? Prisma.sql`${entity.extras}` : null;
      const embedding = entity.embedding
        ? Prisma.sql`${pgvector.toSql(entity.embedding)}::vector`
        : null;

      return Prisma.sql`(${id}, ${entity.type}, ${model}, ${ancestors}, ${environmentId}, ${extras}, ${embedding})`;
    });

    return Prisma.sql`INSERT INTO "public"."Entity" (id, type, model, ancestors, "environmentId", extras, embedding) VALUES
    ${Prisma.join(values)}
    RETURNING id`;
  }

  private toModelSelectSql(fields?: string[]): Sql {
    const defaultFields = Prisma.sql`id, type, ancestors, extras`;

    const jsonFields = fields?.length
      ? Prisma.sql`${defaultFields}, jsonb_strip_nulls(jsonb_build_object(${Prisma.raw(fields.map((field) => `'${field}', model->>'${field}'`).join(","))})) AS model`
      : Prisma.sql`${defaultFields}, model`;
    return Prisma.sql`SELECT ${jsonFields} FROM public."Entity"`;
  }

  private generateSqlQueryWhereClause({
    propFilters,
    ancestors,
    parentId,
    appName,
    envName,
    entityTypes,
  }: {
    propFilters: Record<string, unknown>;
    ancestors: string[];
    parentId?: string;
    appName: string;
    envName: string;
    entityTypes: string[];
  }): Sql {
    const type = `${appName}/${envName}/${entityTypes.join("/")}%`;
    const typeSql = Prisma.sql`type LIKE ${type}`;

    const ancestorSql =
      parentId && ancestors.length
        ? Prisma.sql`'AND ancestors = {${ancestors.map((value) => `'${value}'`).join(",")}}'`
        : Prisma.empty;

    const propFilterKeys = R.keys(propFilters);
    const modelFilterSql = propFilterKeys.length
      ? Prisma.sql`AND ${Prisma.join(
          propFilterKeys.map(
            (key) => Prisma.sql`model->>${key} = ${propFilters[key]}`,
          ),
          " AND ",
        )}`
      : Prisma.empty;

    return Prisma.sql`WHERE ${typeSql} ${ancestorSql} ${modelFilterSql}`;
  }

  private getAggregateQuery({
    propFilters,
    onlyProps,
    paginationQuery: { skip, limit },
    appName,
    envName,
    parentId,
    ancestors,
    entityTypes,
  }: {
    propFilters: Record<string, unknown>;
    paginationQuery: { skip: number; limit: number };
    onlyProps?: string[];
    appName: string;
    envName: string;
    parentId?: string;
    ancestors: string[];
    entityTypes: string[];
  }): Sql {
    const whereClause = this.generateSqlQueryWhereClause({
      propFilters,
      ancestors,
      appName,
      envName,
      entityTypes,
      parentId,
    });

    const query = Prisma.sql`WITH Data AS (
            ${this.toModelSelectSql(onlyProps)}
            ${whereClause}
    )
    SELECT
            *,
            (SELECT COUNT(*) FROM Data) AS totalCount
    FROM Data`;

    const orderBy = Prisma.empty;
    const pagination = Prisma.sql`OFFSET ${skip} LIMIT ${limit}`;

    return Prisma.sql`${query} ${orderBy} ${pagination};`;
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
  }): Promise<EntityAggregateResult> {
    const query = this.getAggregateQuery({
      propFilters,
      onlyProps: metaFilters?.only,
      entityTypes,
      paginationQuery,
      appName,
      envName,
      parentId,
      ancestors,
    });

    const result =
      await this.prisma.$queryRaw<(Entity & { totalCount: number })[]>(query);

    console.log("result", result);
    return {
      totalCount: result[0]?.totalCount || 0,
      entities: result.map((entity) => R.omit(["totalCount"], entity)),
    };
  }

  public async searchEntities({
    embedding,
    limit,
    entityType,
  }: {
    embedding: number[];
    vectorIndex: string;
    limit: number;
    entityType?: string;
  }): Promise<Record<string, unknown>[]> {
    const embeddingSql = pgvector.toSql(embedding);

    const whereClause = entityType
      ? Prisma.sql`WHERE type = '${entityType}'`
      : Prisma.empty;

    const entities = await this.prisma.$queryRaw<
      Pick<Entity, "id" | "model">[]
    >`SELECT id,model FROM "public"."Entity" ${whereClause} ORDER BY embedding <-> ${embeddingSql}::vector LIMIT ${limit}`;

    return entities.map((entity) => ({ id: entity.id, ...entity.model }));
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
