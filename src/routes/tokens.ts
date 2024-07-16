import type Context from "../utils/context.ts";
import { type User } from "../models/user.model.ts";
import { getUserFromClerk } from "../services/user.service.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  tokenDeleteEnvironmentSchema,
  tokenDeleteSchema,
  tokenPostEnvironmentSchema,
  tokenPostSchema,
} from "./schemas/token-schemas.ts";
import {
  createTokenForApplication,
  createTokenForEnvironment,
  deleteAppToken,
  deleteEnvironmentToken,
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

tokenApp.openapi(tokenDeleteSchema, async (c) => {
  const { appName } = c.req.valid("param");
  const clerkClient = c.get("clerk");
  const user = await getUserFromClerk(clerkClient, c);
  const deleted = await deleteAppToken({
    context: c.get("context"),
    appName,
    clerkId: user?.id,
    tokenPermissions: c.get("tokenPermissions"),
  });

  return c.json(
    { success: deleted },
    {
      status: 200,
    },
  );
});

tokenApp.openapi(tokenDeleteEnvironmentSchema, async (c) => {
  const { appName, envName } = c.req.valid("param");
  const clerkClient = c.get("clerk");
  const user = await getUserFromClerk(clerkClient, c);
  const deleted = await deleteEnvironmentToken({
    context: c.get("context"),
    appName,
    envName,
    clerkId: user?.id,
    tokenPermissions: c.get("tokenPermissions"),
  });

  return c.json(
    { success: deleted },
    {
      status: 200,
    },
  );
});

export default tokenApp;
