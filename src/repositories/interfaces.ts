import { type Application } from "../models/application.model.ts";
import { type Environment } from "../models/environment.model.ts";
import { type Entity } from "../models/entity.model.ts";
import { type User } from "../models/user.model.ts";
import type { EntityQueryMeta } from "../utils/types.ts";
import type { EntityAggregateResult } from "../services/entity.service.ts";

export interface IApplicationRepository {
  getApplication(props: { appName: string; clerkId: string }): Promise<
    | (Omit<Application, "environments"> & {
        environments: Pick<Environment, "_id" | "name" | "description">[];
      })
    | null
  >;
  getUserApplications(props: { clerkId: string }): Promise<Application[]>;
  createApplication(props: {
    appName: string;
    clerkId: string;
    image: string;
    appDescription: string;
  }): Promise<void>;
  updateApplication(props: {
    oldAppName: string;
    clerkId: string;
    updateProps: {
      newAppName?: string;
      description?: string;
      image?: string;
    };
  }): Promise<Omit<Application, "environments"> | null>;
  deleteApplication(props: {
    appName: string;
    clerkId: string;
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
    entityTypes: string[];
    appName: string;
    envName: string;
  }): Promise<Entity | null>;
  getEntities(props: {
    propFilters: Record<string, unknown>;
    metaFilters?: EntityQueryMeta;
    paginationQuery: { skip: number; limit: number };
    appName: string;
    envName: string;
    parentId?: string;
    ancestors: string[];
    entityTypes: string[];
  }): Promise<EntityAggregateResult[]>;
  searchEntities(props: {
    embedding: number[];
    vectorIndex: string;
    limit: number;
    entityType?: string;
  }): Promise<Entity[]>;
  findEntitiesByIdsTypeAndAncestors(props: {
    ids: string[];
    type: string;
    ancestors: string[];
  }): Promise<Omit<Entity, "embedding">[]>;
  createOrOverwriteEntities(props: {
    entityTypes: string[];
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
  deleteSubEntitiesAndUpdateEnv(props: {
    appName: string;
    envName: string;
    entityTypes: string[];
    ancestors: string[];
    dbEnvironmentId: string;
  }): Promise<{ done: number }>;
  deleteSingleEntityAndUpdateEnv(props: {
    entityId: string;
    appName: string;
    envName: string;
    entityTypes: string[];
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
