import { HTTPException } from "hono/http-exception";
import type { BackendTokenPermissions } from "../utils/types.ts";
import type Context from "../utils/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";
import { APPLICATION_REPOSITORY } from "../utils/const.ts";

const verifyApplicationTokenPermissions = ({
  routeAppName,
  appName,
  envNames,
  routeEnvName,
  method,
}: {
  routeAppName?: string;
  routeEnvName?: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET";
  appName: string;
  envNames: string[];
}): void => {
  if (routeAppName && routeAppName !== appName) {
    throw new HTTPException(401, {
      message: "No access to this application",
    });
  }

  // method !== POST is because you should be able to create a new environment with the application token
  if (routeEnvName && !envNames.includes(routeEnvName) && method !== "POST") {
    throw new HTTPException(401, {
      message: "No access to this environment",
    });
  }
};

const verifyEnvironmentTokenPermissions = ({
  routeAppName,
  appName,
  envNames,
  routeEnvName,
  method,
}: {
  routeAppName?: string;
  routeEnvName?: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET";
  appName: string;
  envNames: string[];
}): void => {
  if (routeAppName && !routeEnvName && method !== "GET") {
    throw new HTTPException(401, {
      message: "You don't have edit permissions on application level",
    });
  }

  if (routeAppName && routeAppName !== appName) {
    throw new HTTPException(401, {
      message: "No access to this application",
    });
  }

  if (routeEnvName && !envNames.includes(routeEnvName) && method !== "POST") {
    throw new HTTPException(401, {
      message: "No access to this environment",
    });
  }
};

const verifyTokenPermissions = async ({
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
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET";
}): Promise<void> => {
  if (method !== "GET" && permissions.permission === "READ_ONLY") {
    throw new HTTPException(401, {
      message: "You don't have write access",
    });
  }

  let appName = permissions.applicationName;
  let envNames = [permissions.environmentName];

  const tokenType = permissions.applicationName ? "application" : "environment";
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

    appName = app.name;
  } else if (permissions.applicationName && permissions.applicationId) {
    const environments = await appRepo.getEnvironmentsByAppId({
      appId: permissions.applicationId,
    });
    envNames = environments.map((env) => env.name);
  }

  if (tokenType === "application") {
    verifyApplicationTokenPermissions({
      routeAppName,
      routeEnvName,
      appName: appName!,
      envNames: envNames as string[],
      method,
    });
  } else {
    verifyEnvironmentTokenPermissions({
      routeAppName,
      routeEnvName,
      appName: appName!,
      envNames: envNames as string[],
      method,
    });
  }
};

export { verifyTokenPermissions };
