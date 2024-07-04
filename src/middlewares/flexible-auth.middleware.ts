import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import userMiddleware from "./user.middleware.ts";
import backendTokenMiddleware from "./backend-token.middleware.ts";

const factory = createFactory();

const middleware = (options: { allowBackendToken?: boolean } = {}) =>
  factory.createMiddleware(async (c, next) => {
    try {
      await userMiddleware(c, next);
    } catch (error) {
      if (options.allowBackendToken) {
        try {
          await backendTokenMiddleware(c, next);
        } catch (tokenError) {
          throw new HTTPException(401, { message: "Authentication failed" });
        }
      } else {
        throw error;
      }
    }
  });

export default middleware;
