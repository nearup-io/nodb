import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { getUserFromClerk } from "../services/user.service.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  tokenPostEnvironmentSchema,
  tokenPostSchema,
} from "./schemas/token-schemas.ts";
import {
  createTokenForApplication,
  createTokenForEnvironment,
} from "../services/token.service.ts";

const tokenApp = new OpenAPIHono<{
  Variables: {
    user: User;
    context: Context;
    tokenPermissions: BackendTokenPermissions;
  };
}>();

tokenApp.openapi(tokenPostSchema, async (c) => {
  const { appName } = c.req.valid("param");
  const clerkClient = c.get("clerk");
  const user = await getUserFromClerk(clerkClient, c);
  const createdToken = await createTokenForApplication({
    context: c.get("context"),
    appName,
    clerkId: user?.id,
    tokenPermissions: c.get("tokenPermissions"),
    permission: c.req.valid("json").permission,
  });

  return c.json(createdToken, {
    status: 201,
  });
});

tokenApp.openapi(tokenPostEnvironmentSchema, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const clerkClient = c.get("clerk");
  const user = await getUserFromClerk(clerkClient, c);
  const createdToken = await createTokenForEnvironment({
    context: c.get("context"),
    appName,
    envName,
    clerkId: user?.id,
    tokenPermissions: c.get("tokenPermissions"),
    permission: c.req.valid("json").permission,
  });

  return c.json(createdToken, {
    status: 201,
  });
});

export default tokenApp;
