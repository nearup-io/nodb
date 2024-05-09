import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type mongoose from "mongoose";
import * as R from "ramda";
import authMiddleware from "../middlewares/auth.middleware";
import dbMiddleware from "../middlewares/db.middleware";
import { searchAiEntities } from "../services/entity.service";
import type { USER_TYPE } from "../utils/auth-utils";
import { ServiceError } from "../utils/service-errors";
import contextMiddleware from "../middlewares/context.middleware.ts";
import type Context from "../middlewares/context.ts";

const app = new Hono<{
  Variables: {
    user: USER_TYPE;
    dbConnection: mongoose.Connection;
    context: Context;
  };
}>();
app.use(authMiddleware);
app.use(dbMiddleware);
app.use(contextMiddleware);

app.post("/:app/:env/*", async (c) => {
  const { app, env } = c.req.param();
  const { path } = c.req;
  const last = R.last(path);
  const entityType = R.replace(
    "/knowledgebase/",
    "",
    last === "/" ? R.init(path) : path,
  );
  const hasTypeFilter = `${app}/${env}` !== entityType;
  const body = await c.req.json();
  if (body.query) {
    try {
      const res = await searchAiEntities({
        context: c.get("context"),
        query: body.query,
        limit: body.limit,
        entityType: hasTypeFilter ? entityType : undefined,
      });
      return c.json(res);
    } catch (e) {
      if (e instanceof ServiceError) {
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
      }
    }
  } else {
    throw new HTTPException(400, {
      message: "Query is not defined",
    });
  }
});

export default app;
