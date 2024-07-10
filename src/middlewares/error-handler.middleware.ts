import { HTTPException } from "hono/http-exception";
import { type Context } from "hono";
import { ServiceError } from "../utils/service-errors.ts";
import { httpError } from "../utils/const.ts";

const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        message: err.message,
        status: err.status,
      },
      err.status,
    );
  }

  if (err instanceof ServiceError) {
    return c.json(
      {
        message: err.message,
        status: err.statusCode,
      },
      err.statusCode,
    );
  }
  // Unhandled errors
  const status = 500;
  const message =
    Bun.env.NODE_ENV === "development" ? err.message : httpError.UNKNOWN;

  if (Bun.env.NODE_ENV === "development") {
    console.log(err);
  }
  return c.json({ message, status }, status);
};

export default errorHandler;
