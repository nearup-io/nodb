import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import { getTokenPermissions } from "../services/token.service.ts";

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

    const { appName, envName } = c.req.param() as {
      appName?: string;
      envName?: string;
    };

    if (appName && appName !== permissions.applicationName) {
      throw new HTTPException(401, {
        message: "No access to this application",
      });
    }

    if (envName && envName !== permissions.environmentName) {
      throw new HTTPException(401, {
        message: "No access to this environment",
      });
    }

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
