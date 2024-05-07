import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type mongoose from "mongoose";
import * as R from "ramda";
import authMiddleware from "../middlewares/auth.middleware";
import dbMiddleware from "../middlewares/db.middleware";
import { searchEntities } from "../services/entity.service";
import type { USER_TYPE } from "../utils/auth-utils";
import { httpError } from "../utils/const";

const app = new Hono<{
  Variables: { user: USER_TYPE; dbConnection: mongoose.Connection };
}>();
app.use(authMiddleware);
app.use(dbMiddleware);

app.post("/:app/:env/*", async (c) => {
  const { app, env } = c.req.param();
  const { path } = c.req;
  const last = R.last(path);
  const entityType = R.replace(
    "/search/",
    "",
    last === "/" ? R.init(path) : path
  );
  const hasTypeFilter = `${app}/${env}` !== entityType;
  const body = await c.req.json();
  if (body.query) {
    try {
      const res = await searchEntities({
        conn: c.get("dbConnection"),
        query: body.query,
        limit: body.limit,
        entityType: hasTypeFilter ? entityType : null,
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
});

export default app;
