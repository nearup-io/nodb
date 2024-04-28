import { createFactory } from "hono/factory";
import { getConnection } from "../connections/connect";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const dbParam = c.req.param("db");
  const connection = getConnection(dbParam)
  c.set("dbConnection", connection);
  await next();
});

export default middleware;
