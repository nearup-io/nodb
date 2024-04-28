import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign as jwt_sign } from "hono/jwt";
import { getConnection as switchConnection } from "../../connections/connect";
import withDb from "../../middlewares/db.middleware";
import { finalizeAuth, getGithubUserData } from "../../services/auth.service";
import type { USER_TYPE } from "../../utils/auth-utils";
import { PROVIDER_GITHUB } from "../../utils/const";

const app = new Hono();

app.get("/", async (c) => {
  const jwtSecret = Bun.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new HTTPException(400, {
      message: "Env is missing",
    });
  }
  const code = c.req.query("code");
  const githubRedirectUrl = Bun.env.GITHUB_CALLBACK_URL;
  if (!code || !githubRedirectUrl) {
    throw new HTTPException(400, {
      message: "Authorization code or redirect URL is missing in the request",
    });
  }
  const db = c.req.query("db");
  if (!db) {
    throw new HTTPException(400, {
      message: "Database parameter is missing in the request",
    });
  }
  switchConnection(db);
  console.log(`Using ${db} database`);
  try {
    const userData: USER_TYPE = await getGithubUserData({
      redirectUrl: githubRedirectUrl,
      code: code,
    });
    if (!userData.email) {
      throw new HTTPException(500, {
        message: "Couldn't store user data",
      });
    }
    const jwtToken = await jwt_sign(userData, jwtSecret);
    c.res.headers.set("Authorization", `Bearer ${jwtToken}`);
    await finalizeAuth({ db, email: userData.email, provider: PROVIDER_GITHUB });
    return c.json({ userData });
  } catch (e: any) {
    console.log(e.message);
    throw new HTTPException(500, {
      message: "Unknown error occured",
    });
  }
});

export default app;
