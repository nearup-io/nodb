import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createEnvironment,
  deleteEnvironment,
  findEnvironment,
  updateEnvironment,
} from "../services/environment.service";
import { httpError } from "../utils/const";
import { asyncTryJson } from "../utils/route-utils";
import entitiesRoute from "./entities";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { flexibleAuthMiddleware } from "../middlewares";
import { ServiceError } from "../utils/service-errors.ts";

const app = new Hono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.get("/", flexibleAuthMiddleware({ allowBackendToken: true }), async (c) => {
  const { appName, envName } = c.req.param() as {
    appName: string;
    envName: string;
  };

  const env = await findEnvironment({
    context: c.get("context"),
    appName,
    envName,
  });

  if (!env) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST, 404);
  }
  return c.json(env);
});

app.post(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const body = await c.req.json();
    const { appName, envName } = c.req.param() as {
      appName: string;
      envName: string;
    };
    const doc = await createEnvironment({
      context: c.get("context"),
      appName,
      envName,
      description: body.description,
    });
    c.status(201);
    return c.json(doc);
  },
);

app.patch(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const body = await asyncTryJson(c.req.json());
    const { appName, envName } = c.req.param() as {
      appName: string;
      envName: string;
    };
    if (envName === body.envName) {
      throw new HTTPException(400, {
        message: httpError.SAME_ENVNAME,
      });
    }
    const doc = await updateEnvironment({
      context: c.get("context"),
      appName,
      newEnvName: body.envName,
      oldEnvName: envName,
      description: body.description,
    });
    if (!doc) return c.json({ found: false });
    return c.json({ found: true });
  },
);

app.delete(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { appName, envName } = c.req.param() as {
      appName: string;
      envName: string;
    };
    const env = await deleteEnvironment({
      context: c.get("context"),
      appName,
      envName,
    });
    return c.json({ found: !!env });
  },
);

app.route("/:entityName", entitiesRoute);

export default app;
