import { HTTPException } from "hono/http-exception";
import type { BackendTokenPermissions } from "../utils/types.ts";
import type Context from "../utils/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";
import { APPLICATION_REPOSITORY } from "../utils/const.ts";

// TODO do I even need this?
const verifyGetPermissions = async ({
  appName,
  envName,
  permissions,
}: {
  permissions: BackendTokenPermissions;
  appName?: string;
  envName?: string;
}): Promise<void> => {
  if (!permissions.applicationName && !permissions.environmentName) {
    throw new HTTPException(401, {
      message: "No permissions set",
    });
  }

  if (
    permissions.applicationName &&
    appName &&
    appName !== permissions.applicationName
  ) {
    throw new HTTPException(401, {
      message: "No access to this application",
    });
  }

  if (
    permissions.environmentName &&
    envName &&
    envName !== permissions.environmentName
  ) {
    throw new HTTPException(401, {
      message: "No access to this environment",
    });
  }
};

const verifyDataManipulationPermissions = async ({
  routeAppName,
  routeEnvName,
  permissions,
  context,
  method,
}: {
  permissions: BackendTokenPermissions;
  context: Context;
  routeAppName?: string;
  routeEnvName?: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
}): Promise<void> => {
  if (permissions.permission === "READ_ONLY") {
    throw new HTTPException(401, {
      message: "You don't have write access",
    });
  }

  let appName = permissions.applicationName;
  let envNames = [permissions.environmentName];

  const appRepo = context.get<IApplicationRepository>(APPLICATION_REPOSITORY);
  if (permissions.environmentName && permissions.environmentId) {
    const app = await appRepo.getApplicationByEnvironmentId({
      environmentId: permissions.environmentId,
    });

    if (!app) {
      throw new HTTPException(401, {
        message: "Something went wrong with your permissions",
      });
    }

    appName = permissions.applicationName;
  } else if (permissions.applicationName && permissions.applicationId) {
    const environments = await appRepo.getEnvironmentsByAppId({
      appId: permissions.applicationId,
    });
    envNames = environments.map((env) => env.name);
  }

  if (routeAppName && routeAppName !== appName) {
    throw new HTTPException(401, {
      message: "No access to this application",
    });
  }

  if (method !== "POST" && routeEnvName && !envNames.includes(routeEnvName)) {
    throw new HTTPException(401, {
      message: "No access to this environment",
    });
  }
};

export { verifyGetPermissions, verifyDataManipulationPermissions };
