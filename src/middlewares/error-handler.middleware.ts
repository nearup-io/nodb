import { HTTPException } from "hono/http-exception";
import { type Context } from "hono";
import { ServiceError } from "../utils/service-errors.ts";
import { httpError } from "../utils/const.ts";
import type { APIError } from "../routes/schemas/error-schemas.ts";

const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    const error: APIError = {
      message: err.message,
      status: err.status,
    };
    return c.json(error, err.status);
  }

  if (err instanceof ServiceError) {
    const error: APIError = {
      message: err.message,
      status: err.statusCode,
    };
    return c.json(error, err.statusCode);
  }
  // Unhandled errors
  if (Bun.env.NODE_ENV === "development") {
    console.log(err);
  }

  const error: APIError = {
    message:
      Bun.env.NODE_ENV === "development" ? err.message : httpError.UNKNOWN,
    status: 500,
  };

  return c.json(error, 500);
};

export default errorHandler;
