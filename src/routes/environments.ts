import { HTTPException } from "hono/http-exception";
import {
  createEnvironment,
  deleteEnvironment,
  findEnvironment,
  updateEnvironment,
} from "../services/environment.service";
import { httpError } from "../utils/const";
import entitiesRoute from "./entities";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  environmentDeleteRoute,
  environmentGetByNameRoute,
  environmentPatchRoute,
  environmentPostRoute,
} from "./schemas/environment-schemas.ts";

const envApp = new OpenAPIHono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

envApp.openapi(environmentGetByNameRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");

  const env = await findEnvironment({
    context: c.get("context"),
    appName,
    envName,
  });

  if (!env) {
    throw new ServiceError(httpError.ENV_DOESNT_EXIST, 404);
  }
  return c.json(env, 200);
});

envApp.openapi(environmentPostRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const body = c.req.valid("json");
  const doc = await createEnvironment({
    context: c.get("context"),
    appName,
    envName,
    description: body.description,
  });
  return c.json(doc, 201);
});

envApp.openapi(environmentPatchRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const body = c.req.valid("json");
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

  return c.json({ found: !!doc }, 200);
});

envApp.openapi(environmentDeleteRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const env = await deleteEnvironment({
    context: c.get("context"),
    appName,
    envName,
  });
  return c.json({ found: !!env }, 200);
});

envApp.route("/:entityName", entitiesRoute);

export default envApp;
