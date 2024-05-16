import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getAuth } from "@hono/clerk-auth";
import { httpError } from "../utils/const.ts";
import { findUserByClerkId } from "../services/user.service.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const clerkClient = c.get("clerk");
  const auth = getAuth(c);

  if (!auth?.userId) {
    throw new HTTPException(401, {
      message: httpError.USER_NOT_AUTHENTICATED,
    });
  }

  const user = findUserByClerkId({
    id: auth.userId,
    context: c.get("context"),
  });

  if (!user) {
    throw new HTTPException(404, { message: httpError.USER_NOT_FOUND });
  }

  c.set("user", user);
  await next();
});

export default middleware;
