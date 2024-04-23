import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as R from "ramda";
import { searchAiEntities } from "../services/entity.service";
import { ServiceError } from "../utils/service-errors";

const app = new Hono();

app.post("/:app/:env/*", async (c) => {
  const { app, env } = c.req.param();
  const { path } = c.req;
  const last = R.last(path);
  const entityType = R.replace(
    "/knowledgebase/",
    "",
    last === "/" ? R.init(path) : path
  );
  const hasTypeFilter = `${app}/${env}` !== entityType;
  const body = await c.req.json();
  if (body.query) {
    try {
      const res = await searchAiEntities({
        query: body.query,
        limit: body.limit,
        entityType: hasTypeFilter ? entityType : null,
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
