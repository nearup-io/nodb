import { createFactory } from "hono/factory";
import Context from "./context.ts";
import {
  APPLICATION_REPOSITORY,
  ENTITY_REPOSITORY,
  ENVIRONMENT_REPOSITORY,
  USER_REPOSITORY,
} from "../utils/const.ts";
import {
  ApplicationRepository as MongoApplicationRepository,
  EntityRepository as MongoEntityRepository,
  EnvironmentRepository as MongoEnvironmentRepository,
  UserRepository as MongoUserRepository,
} from "../repositories/mongodb";
import {
  ApplicationRepository as PgApplicationRepository,
  EntityRepository as PgEntityRepository,
  EnvironmentRepository as PgEnvironmentRepository,
  UserRepository as PgUserRepository,
} from "../repositories/postgres";
import type { PrismaClient } from "@prisma/client";

const factory = createFactory();

const middleware = (prismaClient: PrismaClient | undefined) =>
  factory.createMiddleware(async (c, next) => {
    const context = new Context();
    if (prismaClient) {
      context.register(
        APPLICATION_REPOSITORY,
        new PgApplicationRepository(prismaClient),
      );
      context.register(
        ENVIRONMENT_REPOSITORY,
        new PgEnvironmentRepository(prismaClient),
      );
      context.register(ENTITY_REPOSITORY, new PgEntityRepository(prismaClient));
      context.register(USER_REPOSITORY, new PgUserRepository(prismaClient));
    } else {
      context.register(
        APPLICATION_REPOSITORY,
        new MongoApplicationRepository(),
      );
      context.register(
        ENVIRONMENT_REPOSITORY,
        new MongoEnvironmentRepository(),
      );
      context.register(ENTITY_REPOSITORY, new MongoEntityRepository());
      context.register(USER_REPOSITORY, new MongoUserRepository());
    }
    c.set("context", context);
    await next();
  });

export default middleware;
