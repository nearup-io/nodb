import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as R from "ramda";
import { searchEntities } from "../services/entity.service";
import { httpError } from "../utils/const";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { flexibleAuthMiddleware } from "../middlewares";

const app = new Hono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.post(
  "/:app/:env/*",
  flexibleAuthMiddleware({ allowBackendToken: true }),
  async (c) => {
    const { app, env } = c.req.param();
    const { path } = c.req;
    const last = R.last(path);
    const entityType = R.replace(
      "/search/",
      "",
      last === "/" ? R.init(path) : path,
    );
    const hasTypeFilter = `${app}/${env}` !== entityType;
    const body = await c.req.json();
    if (body.query) {
      try {
        const res = await searchEntities({
          context: c.get("context"),
          query: body.query,
          limit: body.limit,
          entityType: hasTypeFilter ? entityType : undefined,
        });
        return c.json(res);
      } catch (e) {
        throw new HTTPException(400, {
          message: httpError.UNKNOWN,
        });
      }
    } else {
      throw new HTTPException(400, {
        message: "Query is not defined",
      });
    }
  },
);

export default app;
