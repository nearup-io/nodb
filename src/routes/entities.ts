import type { BlankSchema } from "hono/types";
import {
  createEntities,
  deleteRootAndUpdateEnv,
  deleteSingleEntityAndUpdateEnv,
  getEntities,
  getSingleEntity,
  replaceEntities,
  updateEntities,
} from "../services/entity.service";
import { type User } from "../models/user.model.ts";
import { mapQueryParams } from "../utils/route-validators";
import type Context from "../utils/context.ts";
import { flexibleAuthMiddleware } from "../middlewares";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  entityDeleteByIdRoute,
  entityDeleteRoute,
  entityGetByIdRoute,
  entityGetRoute,
  entityPatchRoute,
  entityPostRoute,
  entityPutRoute,
} from "./schemas/entity-schemas.ts";

const entityApp = new OpenAPIHono<
  {
    Variables: {
      user: User;
      context: Context;
    };
  },
  BlankSchema,
  "/:appName/:envName/:entityName"
>();

entityApp.use(flexibleAuthMiddleware({ allowBackendToken: true }));

entityApp.openapi(entityGetRoute, async (c) => {
  const mappedQuery = mapQueryParams(c.req.valid("query"));

  const context = c.get("context");

  const result = await getEntities({
    context,
    propFilters: mappedQuery.props,
    metaFilters: mappedQuery.meta,
    routeParams: c.req.valid("param"),
    rawQuery: c.req.query(),
  });
  return c.json(result, 200);
});

entityApp.openapi(entityGetByIdRoute, async (c) => {
  const mappedQueryParams = mapQueryParams(c.req.valid("query"));
  const context = c.get("context");
  const entity = await getSingleEntity({
    xpath: c.req.path,
    context,
    requestParams: c.req.valid("param"),
    metaFilters: mappedQueryParams.meta,
  });
  return c.json(entity, 200);
});

entityApp.openapi(entityPostRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");

  const ids = await createEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities: c.req.valid("json"),
  });
  return c.json({ ids }, 201);
});

entityApp.openapi(entityPutRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");

  const body = c.req.valid("json");
  const ids = await replaceEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities: c.req.valid("json"),
  });

  return c.json({ ids }, 200);
});

entityApp.openapi(entityPatchRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");
  const ids = await updateEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities: c.req.valid("json"),
  });

  return c.json({ ids }, 200);
});

entityApp.openapi(entityDeleteRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");
  const context = c.get("context");
  const res = await deleteRootAndUpdateEnv({
    context,
    appName,
    envName,
    entityName,
  });
  return c.json({ deleted: res.done }, 200);
});

entityApp.openapi(entityDeleteByIdRoute, async (c) => {
  const { appName, envName, entityName, entityId } = c.req.valid("param");
  const context = c.get("context");
  const res = await deleteSingleEntityAndUpdateEnv({
    context,
    appName,
    envName,
    entityName,
    entityId,
  });

  return c.json({ deleted: !!res }, 200);
});

export default entityApp;
