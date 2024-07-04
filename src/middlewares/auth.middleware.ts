import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { httpError } from "../utils/const.ts";
import {
  findUserByClerkId,
  getUserFromClerk,
} from "../services/user.service.ts";
import { getTokenPermissions } from "../services/token.service.ts";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  // TODO fetch backend token and do some validation
  const context = c.get("context");
  const token = c.req.header("token");
  console.log(c.req.header());
  if (token) {
    const permissions = await getTokenPermissions({
      token,
      context,
    });

    if (permissions) {
      console.log(permissions);
      // TODO set a flag or something idk
      await next();
      return;
    }
  }

  const clerkUser = await getUserFromClerk(c.get("clerk"), c);
  if (!clerkUser) {
    throw new HTTPException(401, {
      message: httpError.USER_NOT_AUTHENTICATED,
    });
  }
  try {
    const user = await findUserByClerkId({
      id: clerkUser.id,
      context,
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
