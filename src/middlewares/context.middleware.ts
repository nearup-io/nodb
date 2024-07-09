import { createFactory } from "hono/factory";
import Context from "../utils/context.ts";
import {
  APPLICATION_REPOSITORY,
  ENTITY_REPOSITORY,
  ENVIRONMENT_REPOSITORY,
  TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from "../utils/const.ts";
import {
  ApplicationRepository as PgApplicationRepository,
  EntityRepository as PgEntityRepository,
  EnvironmentRepository as PgEnvironmentRepository,
  TokenRepository as PgTokenRepository,
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
    context.register(TOKEN_REPOSITORY, new PgTokenRepository(prismaClient));

    c.set("context", context);
    await next();
  });

export default middleware;
