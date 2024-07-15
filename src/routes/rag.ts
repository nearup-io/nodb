import { searchAiEntities } from "../services/entity.service";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { searchSchemaPostRoute } from "./schemas/search-schemas.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  ragSchemaPostEntityRoute,
  ragSchemaPostRoute,
} from "./schemas/rag-schemas.ts";

const app = new OpenAPIHono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.openapi(searchSchemaPostRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");

  const body = c.req.valid("json");
  const res = await searchAiEntities({
    context: c.get("context"),
    query: body.query,
    limit: body.limit,
    appName,
    envName,
  });
  return c.json(res);
});

app.openapi(ragSchemaPostRoute, async (c) => {
  const { appName, envName } = c.req.valid("param");

  const body = c.req.valid("json");
  const res = await searchAiEntities({
    context: c.get("context"),
    query: body.query,
    limit: body.limit,
    appName,
    envName,
  });
  return c.json(res);
});

app.openapi(ragSchemaPostEntityRoute, async (c) => {
  const { appName, envName, entityName } = c.req.valid("param");
  const body = c.req.valid("json");
  const res = await searchAiEntities({
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
