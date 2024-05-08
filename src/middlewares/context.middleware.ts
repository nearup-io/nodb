import { createFactory } from "hono/factory";
import Context from "./context.ts";
import {
  APPLICATION_MONGO_DB_REPOSITORY,
  ENVIRONMENT_MONGO_DB_REPOSITORY,
} from "../utils/const.ts";
import {
  ApplicationRepository,
  EnvironmentRepository,
} from "../repositories/mongodb";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const context = new Context();
  context.register(
    APPLICATION_MONGO_DB_REPOSITORY,
    new ApplicationRepository(c.get("dbConnection")),
  );
  context.register(
    ENVIRONMENT_MONGO_DB_REPOSITORY,
    new EnvironmentRepository(c.get("dbConnection")),
  );
  c.set("context", context);
  await next();
});

export default middleware;
