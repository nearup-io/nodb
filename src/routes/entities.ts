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
import { RoutingError, ServiceError } from "../utils/service-errors";
import type {
  EntityRequestDto,
  EntityRouteParams,
  PostEntityRequestDto,
} from "../utils/types.ts";
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

app.get(
  "/",
  entityQueryValidator(),
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const q = c.req.valid("query");
    const context = c.get("context");

    try {
      const result = await getEntities({
        context,
        propFilters: q.props,
        metaFilters: q.meta,
        routeParams: c.req.param() as EntityRouteParams,
        rawQuery: c.req.query(),
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof ServiceError) {
        if (
          [httpError.ENV_DOESNT_EXIST, httpError.ENTITY_NOT_FOUND].includes(
            error.explicitMessage,
          )
        ) {
          throw new HTTPException(404, {
            message: error.explicitMessage,
          });
        } else {
          throw new HTTPException(400, {
            message: error.explicitMessage,
          });
        }
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

app.get(
  "/:entityId",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  entityQueryValidator(),
  async (c) => {
    const q = c.req.valid("query");
    const context = c.get("context");

    try {
      const entity = await getSingleEntity({
        xpath: c.req.path,
        context,
        requestParams: c.req.param() as EntityRouteParams & {
          entityId: string;
        },
        metaFilters: q.meta,
      });
      return c.json(entity);
    } catch (error) {
      if (error instanceof ServiceError) {
        if (
          [httpError.ENV_DOESNT_EXIST, httpError.ENTITY_NOT_FOUND].includes(
            error.explicitMessage,
          )
        ) {
          throw new HTTPException(404, {
            message: error.explicitMessage,
          });
        } else {
          throw new HTTPException(400, {
            message: error.explicitMessage,
          });
        }
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

app.post(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { appName, envName, entityName } = c.req.param();

    const body = (await asyncTryJson(c.req.json())) as PostEntityRequestDto[];
    if (!Array.isArray(body)) {
      throw new HTTPException(400, {
        message: httpError.BODY_IS_NOT_ARRAY,
      });
    }
    try {
      const ids = await createOrOverwriteEntities({
        context: c.get("context"),
        appName,
        envName,
        entityName,
        bodyEntities: body,
      });
      c.status(201);
      return c.json({ ids });
    } catch (e) {
      if (e instanceof ServiceError || e instanceof RoutingError) {
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

app.delete(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { appName, envName, entityName } = c.req.param();
    const context = c.get("context");
    try {
      const res = await deleteRootAndUpdateEnv({
        context,
        appName,
        envName,
        entityName,
      });
      return c.json({ deleted: res.done });
    } catch (error) {
      if (error instanceof ServiceError) {
        if (error.explicitMessage === httpError.ENV_DOESNT_EXIST) {
          throw new HTTPException(404, {
            message: error.explicitMessage,
          });
        } else {
          throw new HTTPException(400, {
            message: error.explicitMessage,
          });
        }
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

app.delete(
  "/:entityId",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { appName, envName, entityName, entityId } = c.req.param();
    const context = c.get("context");
    try {
      const res = await deleteSingleEntityAndUpdateEnv({
        context,
        appName,
        envName,
        entityName,
        entityId,
      });

      return c.json({ deleted: !!res });
    } catch (error) {
      if (error instanceof ServiceError) {
        if (error.explicitMessage === httpError.ENV_DOESNT_EXIST) {
          throw new HTTPException(404, {
            message: error.explicitMessage,
          });
        } else {
          throw new HTTPException(400, {
            message: error.explicitMessage,
          });
        }
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

app.put("/", flexibleAuthMiddleware({ allowBackendToken: true }), async (c) => {
  const { appName, envName, entityName } = c.req.param();

  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const ids = await replaceEntities({
      context: c.get("context"),
      appName,
      envName,
      entityName,
      bodyEntities,
    });

    return c.json({ ids });
  } catch (e) {
    if (e instanceof ServiceError) {
      throw new HTTPException(400, {
        message: e.explicitMessage,
      });
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.patch(
  "/",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { appName, envName, entityName } = c.req.param();
    const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
    if (!Array.isArray(bodyEntities)) {
      throw new HTTPException(400, {
        message: httpError.BODY_IS_NOT_ARRAY,
      });
    }
    try {
      const ids = await updateEntities({
        context: c.get("context"),
        appName,
        envName,
        entityName,
        bodyEntities,
      });

      return c.json({ ids });
    } catch (e) {
      if (e instanceof ServiceError) {
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
      } else {
        throw new HTTPException(500, {
          message: httpError.UNKNOWN,
        });
      }
    }
  },
);

export default app;
