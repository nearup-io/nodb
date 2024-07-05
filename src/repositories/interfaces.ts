import type { Application } from "../models/application.model.ts";
import type { Environment } from "../models/environment.model.ts";
import type { Entity } from "../models/entity.model.ts";
import type { User } from "../models/user.model.ts";
import type {
  BackendTokenPermissions,
  EntityQueryMeta,
} from "../utils/types.ts";
import type { EntityAggregateResult } from "../services/entity.service.ts";
import type { Token } from "../models/token.model";

export interface IApplicationRepository {
  getApplication(props: {
    appName: string;
    clerkId?: string;
    token?: string;
  }): Promise<Application | null>;
  getUserApplications(props: { clerkId: string }): Promise<
    (Omit<Application, "id" | "environments"> & {
      environments: Omit<Environment, "id" | "description">[];
    })[]
  >;
  getTokenApplication(props: {
    tokenPermissions: BackendTokenPermissions;
  }): Promise<
    | (Omit<Application, "id" | "environments"> & {
        environments: Omit<Environment, "id" | "description">[];
      })
    | null
  >;
  createApplication(props: {
    appName: string;
    clerkId?: string;
    image?: string;
    appDescription?: string;
    environmentName?: string;
    environmentDescription?: string;
  }): Promise<{
    applicationName: string;
    environmentName: string;
    tokens: Token[];
  }>;
  updateApplication(props: {
    oldAppName: string;
    clerkId?: string;
    token?: string;
    updateProps: {
      name?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Omit<Application, "environments" | "tokens"> | null>;
  deleteApplication(props: {
    appName: string;
    clerkId: string;
    dbAppId: string;
  }): Promise<Omit<Application, "environments"> | null>;
}

export interface IEnvironmentRepository {
  findEnvironment(props: {
    envName: string;
    appName: string;
  }): Promise<Environment | null>;
  createEnvironment(props: {
    envName: string;
    appName: string;
    description?: string;
  }): Promise<Environment>;
  deleteEnvironment(props: {
    appName: string;
    envName: string;
    environmentDbId: string;
  }): Promise<void>;
  updateEnvironment(props: {
    databaseEnvironmentId: string;
    updateProps: { name?: string; description?: string };
  }): Promise<Environment | null>;
}

export interface IEntityRepository {
  getSingleEntity(props: {
    entityId: string;
    entityName: string;
    appName: string;
    envName: string;
  }): Promise<Entity | null>;
  getEntities(props: {
    propFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    entityName: string;
  }): Promise<EntityAggregateResult>;
  searchEntities(props: {
    embedding: number[];
    limit: number;
    entityType?: string;
  }): Promise<Record<string, unknown>[]>;
  findEntitiesByIdsType(props: {
    ids: string[];
    type: string;
  }): Promise<Omit<Entity, "embedding">[]>;
  createOrOverwriteEntities(props: {
    entityName: string;
    dbEnvironmentId: string;
    insertEntities: Entity[];
    entitiesIdsToBeReplaced: string[];
  }): Promise<string[]>;
  replaceEntities(props: {
    ids: string[];
    entitiesToBeInserted: Entity[];
  }): Promise<string[]>;
  deleteRootAndUpdateEnv(props: {
    appName: string;
    envName: string;
    entityName: string;
    dbEnvironmentId: string;
  }): Promise<{ done: number }>;
  deleteSingleEntityAndUpdateEnv(props: {
    entityId: string;
    appName: string;
    envName: string;
    entityName: string;
    dbEnvironmentId: string;
  }): Promise<Entity | null>;
}

export interface IUserRepository {
  createUser(props: {
    clerkId: string;
    appName: string;
    email: string;
  }): Promise<Omit<User, "applications">>;
  updateUserLastUse(props: {
    clerkId: string;
  }): Promise<Omit<User, "applications"> | null>;
  findUserClerkId(id: string): Promise<Omit<User, "applications"> | null>;
}

export interface ITokenRepository {
  getAllTokens(props: {
    app: string;
    env: string;
  }): Promise<Omit<Token, "environments">[]>;
  // TODO rename method
  getTokenPermissions(props: {
    token: string;
  }): Promise<BackendTokenPermissions | null>;
}
