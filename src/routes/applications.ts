import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createApplication,
  deleteApplication,
  getApplication,
  getUserApplications,
  updateApplication,
} from "../services/application.service";
import { APPNAME_MIN_LENGTH, APPNAME_REGEX, httpError } from "../utils/const";
import { ServiceError } from "../utils/service-errors";
import envsRoute from "./environments";
import type Context from "../middlewares/context.ts";
import { type User } from "../models/user.model.ts";

const app = new Hono<{
  Variables: {
    user: User;
    context: Context;
  };
}>();

app.get("/all", async (c) => {
  const user = c.get("user");
  try {
    const apps = await getUserApplications({
      context: c.get("context"),
      clerkId: user.clerkId,
    });
    return c.json(apps);
  } catch (e) {
    console.log(e);
    throw new HTTPException(500, {
      message: "Unknown error",
    });
  }
});

app.get("/:appName", async (c) => {
  const appName = c.req.param("appName");
  const user = c.get("user");

  try {
    const application = await getApplication({
      context: c.get("context"),
      appName,
      clerkId: user.clerkId,
    });
    return c.json(application);
  } catch (err) {
    if (err instanceof ServiceError) {
      throw new HTTPException(404, {
        message: err.explicitMessage,
      });
    } else {
      throw new HTTPException(500, {
        message: "Couldn't fetch application",
      });
    }
  }
});

app.post("/:appName", async (c) => {
  const appName = c.req.param("appName");
  const body = await c.req.json();
  if (appName.length < APPNAME_MIN_LENGTH) {
    throw new HTTPException(400, {
      message: `App name must be at least ${APPNAME_MIN_LENGTH} characters long`,
    });
  }
  if (!APPNAME_REGEX.test(appName)) {
    throw new HTTPException(400, {
      message: `App name follow hyphenated-url-pattern`,
    });
  }
  const user = c.get("user");

  try {
    await createApplication({
      context: c.get("context"),
      appName,
      image: body.image || "",
      clerkId: user.clerkId,
      appDescription: body.description || "",
    });
    c.status(201);
    return c.json({ success: "success" });
  } catch (err) {
    if (err instanceof ServiceError) {
      throw new HTTPException(400, { message: err.explicitMessage });
    } else {
      throw new HTTPException(500, {
        message: "Unknown error",
      });
    }
  }
});

app.patch("/:appName", async (c) => {
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
      context: c.get("context"),
      oldAppName: appName,
      newAppName: body.appName,
      clerkId: user.clerkId,
      description: body.description,
      image: body.image,
    });
    if (!doc?.name) {
      c.status(404);
      return c.json({ found: false });
    }
    return c.json({ found: true });
  } catch (err) {
    console.log(err);
    throw new HTTPException(500, {
      message: httpError.UNKNOWN,
    });
  }
});

app.delete("/:appName", async (c) => {
  const user = c.get("user");
  const appName = c.req.param("appName");
  try {
    const app = await deleteApplication({
      context: c.get("context"),
      appName,
      clerkId: user.clerkId,
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
