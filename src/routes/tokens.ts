import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const";
import type Context from "../middlewares/context.ts";
import { type User } from "../models/user.model.ts";
import { getAllTokens } from "../services/token.service.ts";

const app = new Hono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.get("/:app/:env", async (c) => {
  const { app, env } = c.req.param();
  try {
    const res = await getAllTokens({
      context: c.get("context"),
      app,
      env,
    });
    return c.json(res);
  } catch (e) {
    throw new HTTPException(400, {
      message: httpError.UNKNOWN,
    });
  }
});

export default app;
