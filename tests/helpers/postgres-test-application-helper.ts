import type { Application } from "../../src/models/application.model.ts";
import type { Entity } from "../../src/models/entity.model.ts";
import type { Environment } from "../../src/models/environment.model.ts";
import { BaseApplicationHelper } from "./base-application-helper.ts";
import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import type { TestUser } from "./testUsers.ts";

export class PostgresTestApplicationHelper
  extends BaseApplicationHelper
  implements ITestApplicationHelper
{
  async insertUser(userData: TestUser, createUser: boolean): Promise<string> {
    throw new Error("Method not implemented.");
  }
  async stopApplication(): Promise<void> {
    throw new Error("Method not implemented.");
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
  async getAppFromDbByName(appName: string): Promise<Application | null> {
    throw new Error("Method not implemented.");
  }
  async getEntityFromDbById(id: string): Promise<Entity | null> {
    throw new Error("Method not implemented.");
  }
  async getUserAppsFromDbByEmail(email: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  async deleteAppByName(name: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async deleteAppsByNames(names: string[]): Promise<void> {
    throw new Error("Method not implemented.");
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
