import { createFactory } from "hono/factory";
import Context from "./context.ts";
import {
  APPLICATION_REPOSITORY,
  ENTITY_REPOSITORY,
  ENVIRONMENT_REPOSITORY,
  USER_REPOSITORY,
} from "../utils/const.ts";
import {
  ApplicationRepository as PgApplicationRepository,
  EntityRepository as PgEntityRepository,
  EnvironmentRepository as PgEnvironmentRepository,
  UserRepository as PgUserRepository,
} from "../repositories/postgres";
import type { PrismaClient } from "@prisma/client";

const factory = createFactory();

const middleware = (prismaClient: PrismaClient) =>
  factory.createMiddleware(async (c, next) => {
    const context = new Context();
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

    c.set("context", context);
    await next();
  });

export default middleware;
