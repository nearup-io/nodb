import { createFactory } from "hono/factory";
import Context from "./context.ts";
import {
  APPLICATION_MONGO_DB_REPOSITORY,
  ENTITY_MONGO_DB_REPOSITORY,
  ENVIRONMENT_MONGO_DB_REPOSITORY,
  USER_MONGO_DB_REPOSITORY,
} from "../utils/const.ts";
import {
  ApplicationRepository,
  EntityRepository,
  EnvironmentRepository,
  UserRepository,
} from "../repositories/mongodb";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const context = new Context();
  context.register(
    APPLICATION_MONGO_DB_REPOSITORY,
    new ApplicationRepository(),
  );
  context.register(
    ENVIRONMENT_MONGO_DB_REPOSITORY,
    new EnvironmentRepository(),
  );
  context.register(ENTITY_MONGO_DB_REPOSITORY, new EntityRepository());
  context.register(USER_MONGO_DB_REPOSITORY, new UserRepository());
  c.set("context", context);
  await next();
});

export default middleware;
