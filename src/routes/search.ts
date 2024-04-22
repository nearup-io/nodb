import { Hono } from "hono";
import { searchEntities } from "../services/entity.service";

const app = new Hono();

app.post("/raw", async (c) => {
  const body = await c.req.json();
  if (body.query) {
    const res = await searchEntities(body.query, body.limit);
    return c.json(res);
  }
  return c.json({ error: "Query not defined" });
});

app.post("/ask", async (c) => {
  const body = await c.req.json();
  if (body.query) {
    const res = await searchEntities(body.query, body.limit, true);
    return c.json(res);
  }
  return c.json({ error: "Query not defined" });
});

export default app;
