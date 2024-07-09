import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import { getTokenPermissions } from "../services/token.service.ts";
import { verifyTokenPermissions } from "../services/permission.service.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const context = c.get("context");
  const token = c.req.header("token");
  if (!token) {
    throw new HTTPException(401, { message: "Token not provided" });
  }

  try {
    const permissions = await getTokenPermissions({
      token,
      context,
    });

    if (!permissions) {
      throw new HTTPException(401, { message: "Token does not exist" });
    }

    const { appName, envName, entityName } = c.req.param() as {
      appName?: string;
      envName?: string;
      entityName?: string;
    };

    await verifyTokenPermissions({
      context,
      routeAppName: appName,
      routeEnvName: envName,
      routeEntityName: entityName,
      permissions,
      method: c.req.method as "POST" | "PUT" | "PATCH" | "DELETE" | "GET",
    });

    c.set("tokenPermissions", permissions);
    await next();
    return;
  } catch (e) {
    if (e instanceof HTTPException) {
      throw e;
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

export default middleware;
