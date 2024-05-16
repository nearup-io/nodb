import { Hono } from "hono";
import { getAuth } from "@hono/clerk-auth";
import type Context from "../middlewares/context.ts";
import { type ClerkClient } from "@clerk/backend";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import {
  createOrFetchUser,
  findUserByEmail,
} from "../services/user.service.ts";
import telegramRoute from "./users/telegram.ts";
import authMiddleware from "../middlewares/auth.middleware.ts";

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
    throw new HTTPException(500, {
      message: httpError.UNKNOWN,
    });
  }
});

app.get("/profile", async (c) => {
  const clerkClient = c.get("clerk");
  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json({
      message: "You are not logged in.",
    });
  }
  const clerkUser = await clerkClient.users.getUser(auth.userId);

  const user = await findUserByEmail({
    email: clerkUser.primaryEmailAddress?.emailAddress || "",
    context: c.get("context"),
  });

  return c.json(user);
});

app.use(authMiddleware);
app.route("/settings/telegram", telegramRoute);

export default app;
