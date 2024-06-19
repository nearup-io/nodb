import type { Application } from "../../src/models/application.model.ts";
import type { Entity } from "../../src/models/entity.model.ts";
import type { Environment } from "../../src/models/environment.model.ts";
import { BaseApplicationHelper } from "./base-application-helper.ts";
import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import type { TestUser } from "./testUsers.ts";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { startApp } from "../../src/server.ts";
import { type PrismaClient as Prisma, PrismaClient } from "@prisma/client";

export class PostgresTestApplicationHelper
  extends BaseApplicationHelper
  implements ITestApplicationHelper
{
  private container: StartedPostgreSqlContainer | undefined;
  private prisma: Prisma | undefined;

  constructor() {
    super();
  }

  async init(): Promise<void> {
    this.container = await new PostgreSqlContainer(
      "postgres:16-alpine",
    ).start();

    // Set new database Url
    const databaseUrl = `postgresql://${this.container.getUsername()}:${this.container.getPassword()}@${this.container.getHost()}:${this.container.getPort()}/${this.container.getDatabase()}`;
    // Execute Prisma migrations
    execSync("npx prisma migrate dev", { env: { DATABASE_URL: databaseUrl } });
    this.application = await startApp();
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }

  async stopApplication(): Promise<void> {
    await this.container?.stop();
  }

  get port(): number {
    return this.container!.getFirstMappedPort();
  }

  async insertUser(
    userData: TestUser,
    createUser: boolean = true,
  ): Promise<string> {
    if (createUser) {
      await this.prisma!.user.create({
        data: {
          clerkId: userData.userId,
          email: userData.email,
          lastUse: Date.now().toString(),
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
  ): Promise<Environment[]> {
    throw new Error("Method not implemented.");
  }
  async getAppFromDbByName(appName: string): Promise<
    | (Omit<Application, "environments"> & {
        environments: Pick<Environment, "name">[];
      })
    | null
  > {
    return this.prisma!.application.findFirst({
      where: {
        name: appName,
      },
      include: {
        environments: {
          select: {
            tokens: false,
            entities: false,
            name: true,
          },
        },
      },
    });
  }
  async getEntityFromDbById(id: string): Promise<Entity | null> {
    const result = await this.prisma!.entity.findFirst({
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
    throw new Error("Method not implemented.");
  }
  async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  async deleteAppByName(name: string): Promise<void> {
    await this.prisma!.application.delete({
      where: {
        name,
      },
    });
  }
  async deleteAppsByNames(names: string[]): Promise<void> {
    await this.prisma!.application.deleteMany({
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
