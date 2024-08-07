import type { Application } from "../../src/models/application.model.ts";
import type { Entity } from "../../src/models/entity.model.ts";
import type { Environment } from "../../src/models/environment.model.ts";
import { BaseApplicationHelper } from "./base-application-helper.ts";
import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import type { TestUser } from "./testUsers.ts";
import { execSync } from "node:child_process";
import { startApp } from "../../src/server.ts";
import { Prisma, PrismaClient } from "@prisma/client";
import { Client } from "pg";
import * as R from "ramda";
import type { TokenPermission } from "../../src/models/token.model.ts";

export class PostgresTestApplicationHelper
  extends BaseApplicationHelper
  implements ITestApplicationHelper
{
  private prismaClient: PrismaClient | undefined;
  private pgClient: Client;
  private readonly dbName: string;

  constructor() {
    super();
    const defaultDb = Bun.env.DEFAULT_POSTGRES_DATABASE_URL;
    const testDatabaseUrl = Bun.env.POSTGRES_URL;

    if (!defaultDb || !testDatabaseUrl) {
      throw new Error("Missing default db environment variable");
    }
    this.dbName = testDatabaseUrl.split("/").at(-1)!;
    this.pgClient = new Client({
      connectionString: defaultDb,
    });
  }

  private get prisma(): PrismaClient {
    return this.prismaClient!;
  }

  async init(): Promise<void> {
    await this.pgClient.connect();
    await this.pgClient.query(`CREATE DATABASE ${this.dbName}`);
    // Execute Prisma migrations
    execSync("npx prisma migrate dev", {
      env: { POSTGRES_URL: Bun.env.POSTGRES_URL! },
    });
    this.application = await startApp({
      postgresDatabaseUrl: Bun.env.POSTGRES_URL!,
    });
    this.prismaClient = new PrismaClient({
      datasourceUrl: Bun.env.POSTGRES_URL!,
    });
    console.log("Database created...");
  }

  async stopApplication(): Promise<void> {
    await this.prisma.$disconnect();
    await this.application!.stopApp();
    await this.pgClient.query(`DROP DATABASE ${this.dbName}`);
    await this.pgClient.end();
    console.log("Database dropped...");
  }

  async insertUser(
    userData: TestUser,
    createUser: boolean = true,
  ): Promise<string> {
    if (createUser) {
      await this.prisma.user.create({
        data: {
          clerkId: userData.userId,
          email: userData.email,
          lastUse: new Date(),
        },
      });
    }

    return userData.jwt;
  }

  async getEntitiesByIdFromDatabase(
    ids: string[],
    sortByProp: string = "model.prop",
  ): Promise<Entity[]> {
    const [first, second] = sortByProp.split(".");
    const orderBy = Prisma.sql`ORDER BY ${Prisma.raw(`${first}->'${second}'`)} ASC NULLS FIRST`;
    return this.prisma.$queryRaw<
      Entity[]
    >`SELECT id, type, model FROM public."Entity" WHERE id IN (${Prisma.join(ids)}) ${orderBy}`;
  }
  async getEnvironmentFromDbByName(name: string): Promise<Environment | null> {
    const result = await this.prisma.environment.findFirst({
      where: { name },
      include: {
        entities: {
          select: {
            type: true,
          },
        },
        tokens: true,
      },
    });
    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      tokens: result.tokens,
      entities: R.uniq(result.entities.map((x) => x.type.split("/").at(-1)!)),
      description: result.description ?? undefined,
    };
  }
  async getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<Omit<Environment, "entities" | "tokens">[]> {
    const result = await this.prisma.environment.findMany({
      where: {
        applicationName: appName,
      },
    });

    return result.map((env) => ({
      ...env,
      description: env.description ?? undefined,
    }));
  }
  async getAppFromDbByName(appName: string): Promise<
    | (Omit<Application, "environments"> & {
        environments: Pick<Environment, "name" | "tokens">[];
      })
    | null
  > {
    const result = await this.prisma.application.findFirst({
      where: {
        name: appName,
      },
      select: {
        id: true,
        environments: {
          select: {
            name: true,
            tokens: {
              select: { key: true, permission: true },
            },
          },
        },
        userId: false,
        description: true,
        image: true,
        name: true,
        tokens: {
          select: {
            key: true,
            permission: true,
          },
        },
      },
    });

    if (!result) return null;

    return {
      ...result,
      image: result.image ?? undefined,
      description: result.description ?? undefined,
    };
  }
  async getEntityFromDbById(id: string): Promise<Entity | null> {
    const result = await this.prismaClient!.entity.findFirst({
      where: {
        id,
      },
    });
    if (!result) return null;
    return {
      ...result,
      model: result.model as Record<string, unknown>,
      extras: result.extras as Record<string, unknown>,
    };
  }
  async getUserAppsFromDbByEmail(email: string): Promise<string[]> {
    const result = await this.prisma.user.findFirst({
      where: { email },
      select: {
        applications: {
          select: {
            name: true,
          },
        },
      },
    });
    return result?.applications.map((x) => x.name) || [];
  }
  async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    const result = await this.prisma.environment.findMany({
      where: {
        applicationName: name,
      },
      select: {
        name: true,
      },
    });

    return result?.map((x) => x.name) || [];
  }
  async deleteAppByName(name: string): Promise<void> {
    await this.prismaClient!.application.delete({
      where: {
        name,
      },
    });
  }
  async deleteAppsByNames(names: string[]): Promise<void> {
    await this.prismaClient!.application.deleteMany({
      where: {
        name: { in: names },
      },
    });
  }
  async getTokenByToken(token: string): Promise<{
    environmentId: string | null;
    applicationId: string | null;
    permission: TokenPermission;
    key: string;
  } | null> {
    return this.prisma.token.findFirst({
      where: {
        key: token,
      },
      select: {
        environmentId: true,
        applicationId: true,
        permission: true,
        key: true,
      },
    });
  }
}
