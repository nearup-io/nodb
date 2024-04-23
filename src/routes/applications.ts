import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import auth from "../middlewares/auth.middleware";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getUserApplications,
  updateApplication,
} from "../services/application.service";
import type { USER_TYPE } from "../utils/auth-utils";
import { APPNAME_MIN_LENGTH, APPNAME_REGEX, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import envsRoute from "./environments";

const app = new Hono<{ Variables: { user: USER_TYPE } }>();

app.get("/all", auth, async (c) => {
  const user = c.get("user");
  const apps = await getUserApplications({
    userEmail: user.email,
  });
  return c.json(apps);
});

app.get("/:appName", auth, async (c) => {
  const appName = c.req.param("appName");
  const user = c.get("user");
  try {
    const application = await getApplication({
      appName,
      userEmail: user.email,
    });
    return c.json(application);
  } catch (err) {
    throw new HTTPException(500, {
      message: "Couldn't fetch application",
    });
  }
});

app.post("/:appName", auth, async (c) => {
  const appName = c.req.param("appName");
  const body = await c.req.json();
  if (appName.length < APPNAME_MIN_LENGTH) {
    throw new HTTPException(500, {
      message: `App name must be at least ${APPNAME_MIN_LENGTH} characters long`,
    });
  }
  if (!APPNAME_REGEX.test(appName)) {
    throw new HTTPException(500, {
      message: `App name follow hyphenated-url-pattern`,
    });
  }
  const user = c.get("user");
  try {
    await createApplication({
      appName,
      image: body.image || "",
      userEmail: user.email,
      appDescription: body.description || "",
    });
    return c.json({ success: "success" });
  } catch (e) {
    console.log('Unknown error', e)
    throw new HTTPException(500, {
      message: "Unknown error",
    });
  }
});

app.patch("/:appName", auth, async (c) => {
  const appName = c.req.param("appName");
  const body = (await c.req.json()) as {
    appName?: string;
    description?: string;
    image?: string;
  };
  if (body.appName && body.appName?.length < APPNAME_MIN_LENGTH) {
    throw new HTTPException(400, {
      message: httpError.APPNAME_LENGTH,
    });
  }
  const notAllowedAppname =
    body.appName &&
    (!APPNAME_REGEX.test(appName) || !APPNAME_REGEX.test(body.appName));
  if (notAllowedAppname) {
    throw new HTTPException(400, {
      message: httpError.APPNAME_NOT_ALLOWED,
    });
  }
  if (appName === body.appName) {
    throw new HTTPException(400, {
      message: httpError.SAME_APPNAME,
    });
  }
  const user = c.get("user");
  try {
    const doc = await updateApplication({
      oldAppName: appName,
      newAppName: body.appName,
      userEmail: user.email,
      description: body.description,
      image: body.image,
    });
    if (!doc?.name) return c.json({ found: false });
    return c.json({ found: true });
  } catch (err) {
    console.log(err);
    throw new HTTPException(500, {
      message: httpError.UNKNOWN,
    });
  }
});

app.delete("/:appName", auth, async (c) => {
  const user = c.get("user");
  const appName = c.req.param("appName");
  try {
    const app = await deleteApplication({
      appName,
      userEmail: user.email,
    });
    if (!app) return c.json({ found: false });
    return c.json({ found: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      if (e.explicitMessage === httpError.APP_DOESNT_EXIST)
        return c.json({ found: false });
      else
        throw new HTTPException(400, {
          message: e.explicitMessage,
        });
    } else {
      throw new HTTPException(500, {
        message: httpError.UNKNOWN,
      });
    }
  }
});

app.route("/:appName/:envName", envsRoute);

export default app;
