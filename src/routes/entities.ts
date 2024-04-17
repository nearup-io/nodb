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
} from "../services/entity.service";
import { httpError } from "../utils/const";
import { entityMetaResponse } from "../utils/entity-utils";
import { asyncTryJson } from "../utils/route-utils";
import { entityQueryValidator } from "../utils/route-validators";
import { RoutingError, ServiceError } from "../utils/service-errors";

const app = new Hono<Env, BlankSchema, "/:appName/:envName/:entityName">();

app.get("/*", entityQueryValidator(), async (c) => {
  const { entityName } = c.req.param();
  const q = c.req.valid("query");
  const { pathRest, pathRestSegments, xpath } = getCommonRouteProps(
    c.req.path,
    c.req.param(),
  );
  const xpathSegments = c.req.path.split("/").filter((x) => x);
  const isEntitiesList = xpathSegments.length % 2 == 0;

  if (isEntitiesList) {
    const entitiesFromDb = await getEntities({
      xpath,
      propFilters: q.props,
      metaFilters: q.meta,
    });
    const { entities } = entitiesFromDb[0];
    if (!entities || R.isEmpty(entities)) {
      return c.json({ [entityName]: [] });
    }
    // TODO: add pagination based on `totalCount`
    const result = entities.map((entity) => ({
      id: entity.id,
      ...R.pick(q.meta?.only || R.keys(entity.model), entity.model),
      __meta: entityMetaResponse({
        hasMeta: q.meta?.hasMeta,
        xpath: xpath,
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
      entityId: R.last(xpathSegments)!,
    });
    return c.json(entity);
  }
});

app.post("/*", async (c) => {
  const { appName, envName, entityName } = c.req.param();
  // TODO: validate
  const body = (await asyncTryJson(c.req.json())) as Omit<Entity, "id">[];
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const { pathRestSegments } = getCommonRouteProps(c.req.path, c.req.param());

    const isSubEntityPath = pathRestSegments.length % 2 === 0;
    if (!isSubEntityPath) {
      throw new RoutingError(httpError.ENTITY_PATH_CREATION);
    }
    const ids = await createOrOverwriteEntities({
      appName,
      envName,
      entityName,
      restSegments: pathRestSegments,
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
  const { pathRest, pathRestSegments, xpath } = getCommonRouteProps(
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
        xpath: xpath,
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

export default app;

const getPathRest = (
  path: string,
  { appName, envName, entityName }: EntityRouteParams,
): string => R.replace(`/apps/${appName}/${envName}/${entityName}`, "", path);

const getPathRestSegments = (path: string): string[] =>
  R.split("/", path).filter((p) => !R.isEmpty(p));

const getXPath = (
  pathRestSegments: string[],
  { appName, envName, entityName }: EntityRouteParams,
): string =>
  R.isEmpty(pathRestSegments)
    ? `${appName}/${envName}/${entityName}`
    : `${appName}/${envName}/${entityName}/${pathRestSegments.join("/")}`;

export type EntityRouteParams = {
  appName: string;
  envName: string;
  entityName: string;
};

const getCommonRouteProps = (
  requestPath: string,
  entityRouteParams: EntityRouteParams,
): { pathRest: string; pathRestSegments: string[]; xpath: string } => {
  const pathRest = getPathRest(requestPath, entityRouteParams);
  const pathRestSegments = getPathRestSegments(pathRest);
  const xpath = getXPath(pathRestSegments, entityRouteParams);

  return {
    pathRest,
    pathRestSegments,
    xpath,
  };
};
