import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign as jwt_sign } from "hono/jwt";
import {
  getGoogleLoginUrl,
  getGoogleUserData,
} from "../../services/auth.service";

const app = new Hono();

app.get("/:db", async (c) => {
  const redirectUrl = c.req.query("redirectUrl") || Bun.env.GOOGLE_REDIRECT_URI;
  if (!redirectUrl) {
    throw new HTTPException(400, {
      message: "Redirect url missing in request",
    });
  }
  const loginUrl = getGoogleLoginUrl({ redirectUrl });
  return c.json({ loginUrl });
});

app.post("/:db", async (c) => {
  const { JWT_SECRET } = Bun.env;
  if (!JWT_SECRET) {
    throw new HTTPException(400, {
      message: "Env is missing",
    });
  }
  const body = await c.req.json();
  if (!body.code || !body.redirectUrl) {
    throw new HTTPException(400, {
      message: "Authorization code or redirect URL is missing in the request",
    });
  }
  try {
    const userData = await getGoogleUserData({
      redirectUrl: body.redirectUrl,
      code: body.code,
    });
    const jwtToken = await jwt_sign(userData, JWT_SECRET);
    c.res.headers.set("Authorization", `Bearer ${jwtToken}`);
    return c.json({
      status: true,
      message: "Login Success",
      ...userData,
    });
  } catch (error) {
    throw new HTTPException(500, {
      message: "Failed to set user data",
    });
  }
});
