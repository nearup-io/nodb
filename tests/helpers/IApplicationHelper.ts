import type { TestUser } from "./testUsers.ts";
import { type Entity as EntityType } from "../../src/models/entity.model.ts";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import { type Application as AppType } from "../../src/models/application.model.ts";
import type { TokenPermission } from "../../src/models/token.model.ts";

export interface ITestApplicationHelper {
  init(): Promise<void>;
  executePostRequest(props: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response>;
  executePatchRequest(props: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response>;
  executePutRequest(props: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response>;
  executeGetRequest(props: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
  }): Promise<Response>;
  executeDeleteRequest(props: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
  }): Promise<Response>;
  insertUser(userData: TestUser, createUser?: boolean): Promise<string>;
  stopApplication(): Promise<void>;
  getEntitiesByIdFromDatabase(
    ids: string[],
    sortByProp?: string,
  ): Promise<EntityType[]>;
  getEnvironmentFromDbByName(name: string): Promise<EnvironmentType | null>;
  getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<Omit<EnvironmentType, "entities" | "tokens">[]>;
  getAppFromDbByName(appName: string): Promise<
    | (Omit<AppType, "environments"> & {
        environments: Pick<EnvironmentType, "name" | "tokens">[];
      })
    | null
  >;
  getEntityFromDbById(id: string): Promise<EntityType | null>;
  getUserAppsFromDbByEmail(email: string): Promise<string[]>;
  getEnvironmentsFromAppName(name: string): Promise<string[]>;
  deleteAppByName(name: string): Promise<void>;
  deleteAppsByNames(names: string[]): Promise<void>;
  getTokenByToken(token: string): Promise<{
    environmentId: string | null;
    applicationId: string | null;
    permission: TokenPermission;
    key: string;
  } | null>;
  createAppWithEnvironmentEntities(props: {
    appName: string;
    environmentName: string;
    jwtToken?: string;
    entityName: string;
    entities: any[];
  }): Promise<{ entityIds: string[]; appToken: string; envToken: string }>;
}
