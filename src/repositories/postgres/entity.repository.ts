import BaseRepository from "./base.repository.ts";
import type { IEntityRepository } from "../interfaces.ts";
import type { EntityQueryMeta, SortBy } from "../../utils/types.ts";
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
      const extras = entity.extras ? Prisma.sql`${entity.extras}` : null;
      const embedding =
        entity.embedding && entity.embedding.length > 0
          ? Prisma.sql`${pgvector.toSql(entity.embedding)}::vector`
          : null;

      return Prisma.sql`(${id}, ${entity.type}, ${model}, ${environmentId}, ${extras}, ${embedding})`;
    });

    return Prisma.sql`INSERT INTO "public"."Entity" (id, type, model, "environmentId", extras, embedding) VALUES
    ${Prisma.join(values)}
    RETURNING id`;
  }

  private toModelSelectSql(fields?: string[]): Sql {
    const defaultFields = Prisma.sql`id, type, extras`;

    const jsonFields = fields?.length
      ? Prisma.sql`${defaultFields}, jsonb_strip_nulls(jsonb_build_object(${Prisma.raw(fields.map((field) => `'${field}', model->'${field}'`).join(","))})) AS model`
      : Prisma.sql`${defaultFields}, model`;
    return Prisma.sql`SELECT ${jsonFields} FROM public."Entity"`;
  }

  private generateSqlQueryWhereClause({
    propFilters,
    appName,
    envName,
    entityName,
  }: {
    propFilters: Record<string, unknown>;
    appName: string;
    envName: string;
    entityName: string;
  }): Sql {
    const type = `${appName}/${envName}/${entityName}`;
    const typeSql = Prisma.sql`type = ${type}`;

    const propFilterKeys = R.keys(propFilters);
    const modelFilterSql = propFilterKeys.length
      ? Prisma.sql`AND ${Prisma.join(
          propFilterKeys.map((key) => {
            const type = typeof propFilters[key];
            const sqlType: string = typeToSqlType[type] ?? "text";
            return Prisma.sql`${Prisma.raw(`(model->>'${key}')::${sqlType}`)} = ${propFilters[key]}`;
          }),
          " AND ",
        )}`
      : Prisma.empty;

    return Prisma.sql`WHERE ${typeSql} ${modelFilterSql}`;
  }

  private getAggregateQuery({
    propFilters,
    onlyProps,
    paginationQuery: { skip, limit },
    appName,
    envName,
    entityName,
    sortBy,
  }: {
    propFilters: Record<string, unknown>;
    paginationQuery: { skip: number; limit: number };
    onlyProps?: string[];
    appName: string;
    envName: string;
    entityName: string;
    sortBy?: SortBy[];
  }): Sql {
    const whereClause = this.generateSqlQueryWhereClause({
      propFilters,
      appName,
      envName,
      entityName,
    });

    const query = Prisma.sql`WITH Data AS (
            ${this.toModelSelectSql(onlyProps)}
            ${whereClause}
    )
    SELECT
            *,
            (SELECT COUNT(*) FROM Data) AS "totalCount"
    FROM Data`;

    const orderBy = sortBy?.length
      ? Prisma.sql`ORDER BY 
      ${Prisma.raw(
        `${sortBy.map((x) => `model->'${x.name}' ${x.order.toUpperCase()}`)}`,
      )}`
      : Prisma.empty;

    const pagination = Prisma.sql`OFFSET ${skip} LIMIT ${limit}`;

    return Prisma.sql`${query} ${orderBy} ${pagination};`;
  }

  public async getSingleEntity({
    entityId,
    entityName,
    appName,
    envName,
  }: {
    entityId: string;
    entityName: string;
    appName: string;
    envName: string;
  }): Promise<Entity | null> {
    const entity = await this.prisma.entity.findFirst({
      where: {
        id: entityId,
        type: `${appName}/${envName}/${entityName}`,
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
    };
  }

  public async getEntities({
    propFilters,
    metaFilters,
    paginationQuery,
    appName,
    envName,
    entityName,
  }: {
    propFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    entityName: string;
  }): Promise<EntityAggregateResult> {
    const query = this.getAggregateQuery({
      propFilters,
      onlyProps: metaFilters?.only,
      entityName,
      paginationQuery,
      appName,
      envName,
      sortBy: metaFilters?.sortBy,
    });

    const result =
      await this.prisma.$queryRaw<(Entity & { totalCount: number })[]>(query);

    return {
      totalCount: result[0] ? Number(result[0]?.totalCount) : 0,
      entities: result.map((entity) => R.omit(["totalCount"], entity)),
    };
  }

  public async searchEntities({
    embedding,
    limit,
    environmentId,
    entityType,
  }: {
    embedding: number[];
    limit: number;
    environmentId: string;
    entityType?: string;
  }): Promise<Record<string, unknown>[]> {
    const embeddingSql = pgvector.toSql(embedding);
    const whereClause = entityType
      ? Prisma.sql`WHERE "environmentId" = ${environmentId} AND type = ${entityType}`
      : Prisma.sql`WHERE "environmentId" = ${environmentId}`;

    const entities = await this.prisma.$queryRaw<
      Pick<Entity, "id" | "model">[]
    >`SELECT id,model FROM "public"."Entity" ${whereClause} ORDER BY embedding <=> ${embeddingSql}::vector LIMIT ${limit}`;

    return entities.map((entity) => ({ id: entity.id, ...entity.model }));
  }

  public async findEntitiesByIdsType({
    ids,
    type,
  }: {
    ids: string[];
    type: string;
  }): Promise<Omit<Entity, "embedding">[]> {
    const entities = await this.prisma.entity.findMany({
      where: {
        id: { in: ids },
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
      };
    });
  }

  public async createOrOverwriteEntities({
    dbEnvironmentId,
    insertEntities,
    entitiesIdsToBeReplaced,
  }: {
    entityName: string;
    dbEnvironmentId: string;
    insertEntities: Entity[];
    entitiesIdsToBeReplaced: string[];
  }): Promise<string[]> {
    return this.transaction(async (prisma) => {
      if (entitiesIdsToBeReplaced.length > 0) {
        await prisma.entity.deleteMany({
          where: { id: { in: entitiesIdsToBeReplaced } },
        });
      }

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
        type: `${appName}/${envName}/${entityName}`,
      },
    });

    return { done: deleted.count };
  }

  public async deleteSingleEntityAndUpdateEnv({
    entityId,
  }: {
    entityId: string;
    appName: string;
    envName: string;
    entityName: string;
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

const typeToSqlType: Record<string, string | undefined> = {
  boolean: "boolean",
  string: "text",
  number: "int",
  bigint: "int",
};

export default EntityRepository;
