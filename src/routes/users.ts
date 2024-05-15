import { Hono } from "hono";
import { getAuth } from "@hono/clerk-auth";
import type Context from "../middlewares/context.ts";
import { type ClerkClient } from "@clerk/backend";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import { createOrFetchUser } from "../services/user.service.ts";

const app = new Hono<{
  Variables: {
    context: Context;
    clerk: ClerkClient;
  };
}>();

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
    console.log(clerkUser.primaryEmailAddress?.emailAddress);
    const user = await createOrFetchUser({
      user: clerkUser,
      context: c.get("context"),
    });
    return c.json(user);
  } catch (e) {
    throw new HTTPException(500, {
      message: httpError.UNKNOWN,
    });
  }
});

export default app;
