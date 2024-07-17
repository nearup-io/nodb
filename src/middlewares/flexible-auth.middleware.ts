import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import userMiddleware from "./user.middleware.ts";
import backendTokenMiddleware from "./backend-token.middleware.ts";

const factory = createFactory();

const middleware = (
  options: { allowBackendToken?: boolean; authNotRequired?: boolean } = {},
) =>
  factory.createMiddleware(async (c, next): Promise<void> => {
    try {
      await userMiddleware(c, next);
    } catch (error) {
      if (options.allowBackendToken) {
        try {
          await backendTokenMiddleware(c, next);
        } catch (tokenError) {
          if (options.authNotRequired) {
            await next();
          }
          if (tokenError instanceof HTTPException) {
            throw tokenError;
          }
          throw new HTTPException(401, { message: "Authentication failed" });
        }
      } else if (options.authNotRequired) {
        await next();
      } else {
        throw error;
      }
    }
  });

export default middleware;
