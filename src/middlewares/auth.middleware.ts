import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verify as jwt_verify } from "hono/jwt";

const factory = createFactory();

const middleware = factory.createMiddleware(async (c, next) => {
  const authorizationHeader = c.req.header("Authorization");
  const secret = Bun.env.JWT_SECRET;
  if (!authorizationHeader || !secret) {
    throw new HTTPException(401, { message: "Unauthorized request" });
  }
  // TODO replace this middleware
  const bearerToken = "RANDOM STRING";
  try {
    const user = await jwt_verify(bearerToken, secret);
    c.set("user", user);
    await next();
  } catch (err) {
    console.log({ err });
    throw new HTTPException(401, { message: "Unauthorized" });
  }
});

export default middleware;
