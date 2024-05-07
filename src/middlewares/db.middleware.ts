import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getConnection } from "../connections/connect";
import { httpError } from "../utils/const";
import { ConnectionError } from "../utils/service-errors";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const dbParam = c.req.param("db");
  try {
    const connection = getConnection(dbParam);
    c.set("dbConnection", connection);
    await next();
  } catch (e) {
    if (e instanceof ConnectionError) {
      throw new HTTPException(400, { message: e.explicitMessage });
    } else {
      throw new HTTPException(400, { message: httpError.UNKNOWN });
    }
  }
});

export default middleware;
