import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BlankSchema } from "hono/types";
import type mongoose from "mongoose";
import * as R from "ramda";
import dbMiddleware from "../middlewares/db.middleware.ts";
import {
  createOrOverwriteEntities,
  deleteRootAndUpdateEnv,
  deleteSingleEntityAndUpdateEnv,
  deleteSubEntitiesAndUpdateEnv,
  getEntities,
  getSingleEntity,
  replaceEntities,
  updateEntities,
} from "../services/entity.service";
import type { USER_TYPE } from "../utils/auth-utils.ts";
import { httpError } from "../utils/const";
import {
  asyncTryJson,
  getCommonEntityRouteProps,
  isEntitiesList,
} from "../utils/route-utils";
import { entityQueryValidator } from "../utils/route-validators";
import { RoutingError, ServiceError } from "../utils/service-errors";
import type { EntityRequestDto, PostEntityRequestDto } from "../utils/types.ts";

const app = new Hono<
  { Variables: { user: USER_TYPE; dbConnection: mongoose.Connection } },
  BlankSchema,
  "/:appName/:envName/:entityName"
>();
app.use(dbMiddleware);

app.get("/*", entityQueryValidator(), async (c) => {
  const q = c.req.valid("query");
  const { xpath, pathRestSegments, xpathEntitySegments } =
    getCommonEntityRouteProps(c.req.path, c.req.param());
  try {
    if (isEntitiesList(pathRestSegments)) {
      const result = await getEntities({
        conn: c.get("dbConnection"),
        xpathEntitySegments,
        propFilters: q.props,
        metaFilters: q.meta,
        routeParams: c.req.param(),
        rawQuery: c.req.query(),
      });
      return c.json(result);
    } else {
      const entity = await getSingleEntity({
        xpath,
        conn: c.get("dbConnection"),
        requestParams: c.req.param(),
        xpathEntitySegments,
        metaFilters: q.meta,
        entityId: R.last(pathRestSegments)!,
      });
      return c.json(entity);
    }
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
});

app.post("/*", async (c) => {
  const { appName, envName } = c.req.param();

  const body = (await asyncTryJson(c.req.json())) as PostEntityRequestDto[];
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const { pathRestSegments, xpathEntitySegments } = getCommonEntityRouteProps(
      c.req.path,
      c.req.param(),
    );

    if (!isEntitiesList(pathRestSegments)) {
      throw new RoutingError(httpError.ENTITY_PATH_CREATION);
    }
    const conn = c.get("dbConnection");
    const ids = await createOrOverwriteEntities({
      conn,
      appName,
      envName,
      xpathEntitySegments,
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
});

app.delete("/*", async (c) => {
  const { appName, envName, entityName } = c.req.param();
  const { pathRestSegments, xpathEntitySegments } = getCommonEntityRouteProps(
    c.req.path,
    c.req.param(),
  );
  const conn = c.get("dbConnection");
  try {
    if (R.isEmpty(pathRestSegments)) {
      const res = await deleteRootAndUpdateEnv({
        conn,
        appName,
        envName,
        entityName,
      });
      return c.json({ deleted: res.done });
    } else if (pathRestSegments.length % 2 === 0) {
      // delete sub entities
      const res = await deleteSubEntitiesAndUpdateEnv({
        conn,
        appName,
        envName,
        xpathEntitySegments,
      });
      return c.json({ deleted: res.done });
    } else {
      // delete single entity
      const res = await deleteSingleEntityAndUpdateEnv({
        conn,
        appName,
        envName,
        xpathEntitySegments,
      });

      return c.json({ deleted: !!res });
    }
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
});

app.put("/*", async (c) => {
  const { appName, envName } = c.req.param();
  const { xpathEntitySegments } = getCommonEntityRouteProps(
    c.req.path,
    c.req.param(),
  );
  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  const conn = c.get("dbConnection");
  try {
    const ids = await replaceEntities({
      conn,
      appName,
      envName,
      xpathEntitySegments,
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

app.patch("/*", async (c) => {
  const { appName, envName } = c.req.param();
  const { xpathEntitySegments } = getCommonEntityRouteProps(
    c.req.path,
    c.req.param(),
  );
  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  const conn = c.get("dbConnection");
  try {
    const ids = await updateEntities({
      conn,
      appName,
      envName,
      xpathEntitySegments,
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

export default app;
