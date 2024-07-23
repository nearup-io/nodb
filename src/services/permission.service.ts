import type { BackendTokenPermissions } from "../utils/types.ts";
import type Context from "../utils/context.ts";
import type { IApplicationRepository } from "../repositories/interfaces.ts";
import { APPLICATION_REPOSITORY, httpError } from "../utils/const.ts";
import { ServiceError } from "../utils/service-errors.ts";

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
    throw new ServiceError(httpError.NO_ACCESS_TO_APP, 403);
  }

  // method !== POST is because you should be able to create a new environment with the application token
  if (routeEnvName && !envNames.includes(routeEnvName) && method !== "POST") {
    throw new ServiceError(httpError.NO_ACCESS_TO_ENV, 403);
  }
};

const verifyEnvironmentTokenPermissions = ({
  routeAppName,
  appName,
  envNames,
  routeEntityName,
  routeEnvName,
  method,
}: {
  routeAppName?: string;
  routeEnvName?: string;
  routeEntityName?: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET";
  appName: string;
  envNames: string[];
}): void => {
  if (routeAppName && !routeEnvName) {
    throw new ServiceError(httpError.NO_EDIT_ACCESS_ON_APP_LEVEL, 403);
  }

  if (routeAppName && routeAppName !== appName) {
    throw new ServiceError(httpError.NO_ACCESS_TO_APP, 403);
  }

  // we still allow creating an environment with an environment token, but no further modifications to it
  if (routeEnvName && !envNames.includes(routeEnvName) && method !== "POST") {
    throw new ServiceError(httpError.NO_ACCESS_TO_ENV, 403);
  }

  // because of the previous edge case we need to include the standard method afterwards since for creating entities we do need to verify the environment
  if (routeEntityName && routeEnvName && !envNames.includes(routeEnvName)) {
    throw new ServiceError(httpError.NO_ACCESS_TO_ENV, 403);
  }
};

const verifyTokenPermissions = async ({
  routeAppName,
  routeEnvName,
  routeEntityName,
  permissions,
  context,
  method,
}: {
  permissions: BackendTokenPermissions;
  context: Context;
  routeAppName?: string;
  routeEnvName?: string;
  routeEntityName?: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET";
}): Promise<void> => {
  if (method !== "GET" && permissions.permission === "READ_ONLY") {
    throw new ServiceError(httpError.NO_WRITE_ACCESS, 403);
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
      throw new ServiceError(httpError.SOMETHING_WRONG_WITH_PERMISSIONS, 403);
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
      routeEntityName,
      appName: appName!,
      envNames: envNames as string[],
      method,
    });
  }
};

export { verifyTokenPermissions };
