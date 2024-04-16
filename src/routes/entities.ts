import { Hono, type Env } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BlankSchema } from "hono/types";
import * as R from "ramda";
import type { IEntity } from "../models/entity.model";
import {
  createOrOverwriteEntities,
  getEntities,
} from "../services/entity.service";
import { httpError } from "../utils/const";
import { entityMetaResponse } from "../utils/entity-utils";
import { asyncTryJson } from "../utils/route-utils";
import { entityQueryValidator } from "../utils/route-validators";
import { ServiceError } from "../utils/service-errors";

const app = new Hono<Env, BlankSchema, "/:appName/:envName/:entityName">();

app.get("/*", entityQueryValidator(), async (c) => {
  const { appName, envName, entityName } = c.req.param();
  const q = c.req.valid("query");
  const xpath = `${appName}/${envName}/${entityName}`;
  const xpathSegments = c.req.path.split("/").filter((x) => x);
  const isEntitiesList = xpathSegments.length % 2 == 0;
  if (isEntitiesList) {
    const entities = await getEntities({
      xpath,
      propFilters: q.props,
      metaFilters: q.meta,
    });
    if (!entities || R.isEmpty(entities)) {
      return c.json({ [entityName]: [] });
    }
    const result = R.map((entity: IEntity) => ({
      id: entity.id,
      ...R.pick(q.meta?.only || R.keys(entity.model), entity.model),
      __meta: entityMetaResponse({
        hasMeta: q.meta?.hasMeta,
        xpath,
        id: entity.id,
      }),
    }))(entities);
    return c.json({
      [entityName]: result,
    });
  } else {
    return c.json({});
  }
});

app.post("/*", async (c) => {
  const { appName, envName, entityName } = c.req.param() as {
    appName: string;
    envName: string;
    entityName: string;
  };
  const body = (await asyncTryJson(c.req.json())) as Omit<IEntity, "id">[];
  if (!Array.isArray(body)) {
    throw new HTTPException(400, {
      message: httpError.BODY_IS_NOT_ARRAY,
    });
  }
  try {
    const ids = await createOrOverwriteEntities({
      appName,
      envName,
      entityName,
      bodyEntities: body,
    });
    return c.json({ ids });
  } catch (e) {
    console.log(e);
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
