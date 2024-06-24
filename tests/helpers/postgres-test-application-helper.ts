import type { Application } from "../../src/models/application.model.ts";
import type { Entity } from "../../src/models/entity.model.ts";
import type { Environment } from "../../src/models/environment.model.ts";
import { BaseApplicationHelper } from "./base-application-helper.ts";
import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import type { TestUser } from "./testUsers.ts";
import { execSync } from "node:child_process";
import { startApp } from "../../src/server.ts";
import { type PrismaClient as Prisma, PrismaClient } from "@prisma/client";
import { Client } from "pg";

export class PostgresTestApplicationHelper
  extends BaseApplicationHelper
  implements ITestApplicationHelper
{
  private prismaClient: Prisma | undefined;
  private pgClient: Client;

  constructor() {
    super();
    this.pgClient = new Client({
      user: "postgres",
      host: "localhost",
      database: "postgres", // Connect to the default 'postgres' database
      password: "postgres",
      port: 5432,
    });
  }

  private get prisma(): Prisma {
    return this.prismaClient!;
  }

  async init(): Promise<void> {
    await this.pgClient.connect();
    await this.pgClient.query("CREATE DATABASE e2e_tests");
    // Set new database Url
    const databaseUrl = `postgresql://postgres:postgres@localhost:5432/e2e_tests`;
    // Execute Prisma migrations
    execSync("npx prisma migrate dev", { env: { POSTGRES_URL: databaseUrl } });
    this.application = await startApp({
      postgresDatabaseUrl: databaseUrl,
    });
    this.prismaClient = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }

  async stopApplication(): Promise<void> {
    await this.prisma.$disconnect();
    await this.application!.stopApp();
    await this.pgClient.query("DROP DATABASE e2e_tests");
    await this.pgClient.end();
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
    sortByProp: string,
  ): Promise<Entity[]> {
    throw new Error("Method not implemented.");
  }
  async getEnvironmentFromDbByName(name: string): Promise<Environment | null> {
    throw new Error("Method not implemented.");
  }
  async getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<Omit<Environment, "entities" | "tokens">[]> {
    return this.prisma.environment.findMany({
      where: {
        applicationName: appName,
      },
    });
  }
  async getAppFromDbByName(appName: string): Promise<
    | (Omit<Application, "environments"> & {
        environments: Pick<Environment, "name">[];
      })
    | null
  > {
    return this.prisma.application.findFirst({
      where: {
        name: appName,
      },
      select: {
        id: true,
        environments: {
          select: {
            name: true,
          },
        },
        userId: false,
        description: true,
        image: true,
        name: true,
      },
    });
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
    throw new Error("Method not implemented.");
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
  async createAppWithEnvironmentEntitiesAndSubEntities({
    appName,
    token,
    environmentName,
    entityName,
    entities,
    subEntityName,
    subEntities,
  }: {
    appName: string;
    environmentName: string;
    token: string;
    entityName: string;
    entities: any[];
    subEntityName?: string | undefined;
    subEntities?: any[] | undefined;
  }): Promise<{
    createdEntityIds: string[];
    createdSubEntityIds?: string[] | undefined;
    entityIdWithSubEntity?: string | undefined;
  }> {
    throw new Error("Method not implemented.");
  }
}
