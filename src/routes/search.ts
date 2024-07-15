import { searchEntities } from "../services/entity.service";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  searchSchemaPostEntityRoute,
  searchSchemaPostRoute,
} from "./schemas/search-schemas.ts";

const app = new OpenAPIHono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.openapi(searchSchemaPostRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const body = c.req.valid("json");
  const res = await searchEntities({
    context: c.get("context"),
    query: body.query,
    limit: body.limit,
    appName,
    envName,
  });
  return c.json(res);
});

app.openapi(searchSchemaPostEntityRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");
  const body = c.req.valid("json");
  const res = await searchEntities({
    context: c.get("context"),
    query: body.query,
    limit: body.limit,
    appName,
    envName,
    entityType: `${appName}/${envName}/${entityName}`,
  });
  return c.json(res);
});

export default app;
