import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import { findUserByClerkId } from "../services/user.service.ts";
import { getAuth } from "@hono/clerk-auth";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const auth = getAuth(c);

  if (!auth?.userId) {
    throw new HTTPException(401, {
      message: httpError.USER_NOT_AUTHENTICATED,
    });
  }
  try {
    const user = await findUserByClerkId({
      id: auth.userId,
      context: c.get("context"),
    });

    if (!user) {
      throw new HTTPException(401, {
        message: httpError.USER_NOT_AUTHENTICATED,
      });
    }

    c.set("user", user);
    await next();
  } catch (e) {
    if (e instanceof HTTPException) {
      throw e;
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

export default middleware;
