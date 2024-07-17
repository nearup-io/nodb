import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import {
  findUserByClerkId,
  getUserFromClerk,
} from "../services/user.service.ts";
import { ServiceError } from "../utils/service-errors.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const clerkUser = await getUserFromClerk(c.get("clerk"), c);
  if (!clerkUser) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
  }
  try {
    const user = await findUserByClerkId({
      id: clerkUser.id,
      context: c.get("context"),
    });

    if (!user) {
      throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
    }

    c.set("user", user);
    await next();
  } catch (e) {
    if (e instanceof ServiceError) {
      throw e;
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

export default middleware;
