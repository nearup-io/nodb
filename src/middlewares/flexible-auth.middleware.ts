import { createFactory } from "hono/factory";
import userMiddleware from "./user.middleware.ts";
import backendTokenMiddleware from "./backend-token.middleware.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { httpError } from "../utils/const.ts";

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
          if (tokenError instanceof ServiceError) {
            throw tokenError;
          }
          throw new ServiceError(httpError.AUTH_FAILED, 401);
        }
      } else if (options.authNotRequired) {
        await next();
      } else {
        throw error;
      }
    }
  });

export default middleware;
