import { Hono, type Env } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BlankSchema } from "hono/types";
import * as R from "ramda";
import type { Entity } from "../models/entity.model";
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
import { httpError } from "../utils/const";
import { entityMetaResponse } from "../utils/entity-utils";
import {
  asyncTryJson,
  getCommonEntityRouteProps,
  isEntitiesList,
} from "../utils/route-utils";
import { entityQueryValidator } from "../utils/route-validators";
import { RoutingError, ServiceError } from "../utils/service-errors";

export type EntityRouteParams = {
  appName: string;
  envName: string;
  entityName: string;
};

export type EntityRequestDto = {
  id: string;
  [key: string]: any;
};

export type PostEntityRequestDto = Omit<EntityRequestDto, "id"> & {
  id?: string;
};

const app = new Hono<Env, BlankSchema, "/:appName/:envName/:entityName">();

app.get("/*", entityQueryValidator(), async (c) => {
  const { entityName } = c.req.param();
  const q = c.req.valid("query");
  const { xpath, pathRestSegments } = getCommonEntityRouteProps(
    c.req.path,
    c.req.param(),
  );
  if (isEntitiesList(pathRestSegments)) {
    const entitiesFromDb = await getEntities({
      xpath,
      propFilters: q.props,
      metaFilters: q.meta,
    });
    const { entities } = entitiesFromDb[0] ?? {};
    if (!entities || R.isEmpty(entities)) {
      return c.json({ [entityName]: [] });
    }
    // TODO: add pagination based on `totalCount`
    const result = entities.map((entity) => ({
      id: entity.id,
      ...R.pick(q.meta?.only || R.keys(entity.model), entity.model),
      __meta: entityMetaResponse({
        hasMeta: q.meta?.hasMeta,
        xpath,
        id: entity.id,
      }),
    }));
    return c.json({
      [entityName]: result,
    });
  } else {
    const entity = await getSingleEntity({
      xpath: c.req.param(),
      metaFilters: q.meta,
      entityId: R.last(pathRestSegments)!,
    });
    return c.json(entity);
  }
});

app.post("/*", async (c) => {
  const { appName, envName, entityName } = c.req.param();

  const body = (await asyncTryJson(c.req.json())) as PostEntityRequestDto[];
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const { pathRestSegments, xpath } = getCommonEntityRouteProps(
      c.req.path,
      c.req.param(),
    );

    if (!isEntitiesList(pathRestSegments)) {
      throw new RoutingError(httpError.ENTITY_PATH_CREATION);
    }
    const ids = await createOrOverwriteEntities({
      appName,
      envName,
      xpath,
      bodyEntities: body,
    });
    return c.json({ ids });
  } catch (e) {
    console.log(e);
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
  const { pathRest, pathRestSegments, xpath } = getCommonEntityRouteProps(
    c.req.path,
    c.req.param(),
  );
  if (R.isEmpty(pathRestSegments)) {
    const res = await deleteRootAndUpdateEnv({ appName, envName, entityName });
    return c.json({ deleted: res.done });
  } else {
    if (pathRestSegments.length % 2 === 0) {
      // delete sub entities
      const res = await deleteSubEntitiesAndUpdateEnv({
        appName,
        envName,
        xpath,
      });
      return c.json({ deleted: res.done });
    } else if (pathRestSegments.length % 2 !== 0) {
      // delete single entity
      const res = await deleteSingleEntityAndUpdateEnv({
        appName,
        envName,
        xpath,
      });

      return c.json({ deleted: !!res });
    }
  }
  return c.json({ pathRest, pathRestSegments });
});

app.put("/*", async (c) => {
  const { appName, envName } = c.req.param();
  const { xpath } = getCommonEntityRouteProps(c.req.path, c.req.param());
  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const ids = await replaceEntities({
      appName,
      envName,
      xpath,
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
  const { xpath } = getCommonEntityRouteProps(c.req.path, c.req.param());
  const bodyEntities = await asyncTryJson<EntityRequestDto[]>(c.req.json());
  if (!Array.isArray(bodyEntities)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const ids = await updateEntities({
      appName,
      envName,
      xpath,
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
