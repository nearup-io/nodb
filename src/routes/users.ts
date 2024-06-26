import { Hono } from "hono";
import { getAuth } from "@hono/clerk-auth";
import type Context from "../middlewares/context.ts";
import { type ClerkClient } from "@clerk/backend";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import { createOrFetchUser } from "../services/user.service.ts";
import { ServiceError } from "../utils/service-errors.ts";

const app = new Hono<{
  Variables: {
    context: Context;
    clerk: ClerkClient;
  };
}>();

// TODO e2e tests
app.post("/auth", async (c) => {
  const clerkClient = c.get("clerk");

  const auth = getAuth(c);
  if (!auth?.userId) {
    throw new HTTPException(401, {
      message: httpError.USER_NOT_AUTHENTICATED,
    });
  }

  const clerkUser = await clerkClient.users.getUser(auth.userId);
  if (!clerkUser) {
    throw new HTTPException(401, {
      message: httpError.USER_NOT_AUTHENTICATED,
    });
  }

  try {
    const user = await createOrFetchUser({
      user: clerkUser,
      context: c.get("context"),
    });
    return c.json(user);
  } catch (e) {
    if (e instanceof ServiceError) {
      throw new HTTPException(400, {
        message: e.explicitMessage,
      });
    } else {
      console.log(e);
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

export default app;
