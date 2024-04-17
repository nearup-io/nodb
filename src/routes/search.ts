import { Hono } from "hono";
import { searchEntities } from "../services/entity.service";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  if (body.query) {
    const res = await searchEntities(body.query);
    return c.json(res);
  }
  return c.json({ error: "Query not defined" });
});

export default app;
