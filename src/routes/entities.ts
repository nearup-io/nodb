import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BlankSchema } from "hono/types";
import {
  createOrOverwriteEntities,
  deleteRootAndUpdateEnv,
  deleteSingleEntityAndUpdateEnv,
  getEntities,
  getSingleEntity,
  replaceEntities,
  updateEntities,
} from "../services/entity.service";
import { type User } from "../models/user.model.ts";
import { httpError } from "../utils/const";
import { asyncTryJson } from "../utils/route-utils";
import { entityQueryValidator } from "../utils/route-validators";
import type { EntityRequestDto, PostEntityRequestDto } from "../utils/types.ts";
import type Context from "../utils/context.ts";
import { flexibleAuthMiddleware } from "../middlewares";

const app = new Hono<
  {
    Variables: {
      user: User;
      context: Context;
    };
  },
  BlankSchema,
  "/:appName/:envName/:entityName"
>();

app.use(flexibleAuthMiddleware({ allowBackendToken: true }));

app.get("/", entityQueryValidator(), async (c) => {
  const q = c.req.valid("query");
  const context = c.get("context");

  const result = await getEntities({
    context,
    propFilters: q.props,
    metaFilters: q.meta,
    routeParams: c.req.param(),
    rawQuery: c.req.query(),
  });
  return c.json(result);
});

app.get("/:entityId", entityQueryValidator(), async (c) => {
  const q = c.req.valid("query");
  const context = c.get("context");
  c.req.param();
  const entity = await getSingleEntity({
    xpath: c.req.path,
    context,
    requestParams: c.req.param(),
    metaFilters: q.meta,
  });
  return c.json(entity);
});

app.post("/", async (c) => {
  const { appName, envName, entityName } = c.req.param();

  const body = (await asyncTryJson(c.req.json())) as PostEntityRequestDto[];
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  const ids = await createOrOverwriteEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities: body,
  });
  c.status(201);
  return c.json({ ids });
});

app.delete("/", async (c) => {
  const { appName, envName, entityName } = c.req.param();
  const context = c.get("context");
  const res = await deleteRootAndUpdateEnv({
    context,
    appName,
    envName,
    entityName,
  });
  return c.json({ deleted: res.done });
});

app.delete("/:entityId", async (c) => {
  const { appName, envName, entityName, entityId } = c.req.param();
  const context = c.get("context");
  const res = await deleteSingleEntityAndUpdateEnv({
    context,
    appName,
    envName,
    entityName,
    entityId,
  });

  return c.json({ deleted: !!res });
});

app.put("/", async (c) => {
  const { appName, envName, entityName } = c.req.param();

  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  const ids = await replaceEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities,
  });

  return c.json({ ids });
});

app.patch("/", async (c) => {
  const { appName, envName, entityName } = c.req.param();
  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  const ids = await updateEntities({
    context: c.get("context"),
    appName,
    envName,
    entityName,
    bodyEntities,
  });

  return c.json({ ids });
});

export default app;
