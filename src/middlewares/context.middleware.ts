import { createFactory } from "hono/factory";
import Context from "./context.ts";
import ApplicationRepository from "../repositories/mongodb/application.repository.ts";
import { APPLICATION_MONGO_DB_REPOSITORY } from "../utils/const.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const context = new Context();
  context.register(
    APPLICATION_MONGO_DB_REPOSITORY,
    new ApplicationRepository(c.get("dbConnection")),
  );
  c.set("context", context);
  await next();
});

export default middleware;
