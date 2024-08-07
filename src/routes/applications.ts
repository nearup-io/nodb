import {
  createApplication,
  deleteApplication,
  getApplicationByName,
  getApplications,
  updateApplication,
} from "../services/application.service";
import { httpError } from "../utils/const";
import envsRoute from "./environments";
import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { getUserFromClerk } from "../services/user.service.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  applicationDeleteRoute,
  applicationGetAllRoute,
  applicationGetByNameRoute,
  applicationPatchRoute,
  applicationPostRoute,
} from "./schemas/application-schemas.ts";
import { ServiceError } from "../utils/service-errors.ts";

const application = new OpenAPIHono<{
  Variables: {
    user: User;
    context: Context;
    tokenPermissions: BackendTokenPermissions;
  };
}>();

application.openapi(applicationPostRoute, async (c) => {
  const { appName } = c.req.valid("param");
  const body = c.req.valid("json");
  const clerkClient = c.get("clerk");
  const user = await getUserFromClerk(clerkClient, c);
  const application = await createApplication({
    context: c.get("context"),
    appName,
    clerkId: user?.id,
    image: body.image || "",
    appDescription: body.description || "",
    environmentName: body.envName,
    environmentDescription: body.envDescription,
  });

  return c.json(application, {
    status: 201,
  });
});

application.openapi(applicationGetAllRoute, async (c) => {
  const user = c.get("user");
  const apps = await getApplications({
    context: c.get("context"),
    clerkId: user?.clerkId,
    tokenPermissions: c.get("tokenPermissions"),
  });
  return c.json(apps, 200);
});

application.openapi(applicationGetByNameRoute, async (c) => {
  const { appName } = c.req.valid("param");
  const user = c.get("user");

  const application = await getApplicationByName({
    context: c.get("context"),
    appName,
    clerkId: user?.clerkId,
    tokenPermissions: c.get("tokenPermissions"),
  });
  return c.json(application, 200);
});

application.openapi(applicationPatchRoute, async (c) => {
  const { appName } = c.req.valid("param");
  const body = c.req.valid("json");
  if (appName === body.appName) {
    throw new ServiceError(httpError.SAME_APPNAME, 400);
  }
  const user = c.get("user");
  const doc = await updateApplication({
    context: c.get("context"),
    oldAppName: appName,
    newAppName: body.appName,
    clerkId: user?.clerkId,
    tokenPermissions: c.get("tokenPermissions"),
    description: body.description,
    image: body.image,
  });
  if (!doc?.name) {
    return c.json({ found: false }, 404);
  }
  return c.json({ found: true }, 200);
});

application.openapi(applicationDeleteRoute, async (c) => {
  const user = c.get("user");
  const { appName } = c.req.valid("param");
  const app = await deleteApplication({
    context: c.get("context"),
    appName,
    clerkId: user?.clerkId,
    tokenPermissions: c.get("tokenPermissions"),
  });
  return c.json({ found: !!app }, 200);
});

application.route("/:appName/:envName", envsRoute);

export default application;
