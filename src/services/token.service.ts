import type Context from "../utils/context.ts";
import type { ITokenRepository } from "../repositories/interfaces.ts";
import { httpError, TOKEN_REPOSITORY } from "../utils/const.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";
import type { TokenPermission } from "../models/token.model.ts";
import { getApplicationByName } from "./application.service.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { findEnvironment } from "./environment.service.ts";

const getTokenPermissions = async ({
  token,
  context,
}: {
  token: string;
  context: Context;
}): Promise<BackendTokenPermissions | null> => {
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  return tokenRepository.getTokenPermissions({ token });
};

const createTokenWithClerkIdForApplicationEnvironment = async ({
  appName,
  envName,
  context,
  clerkId,
  permission,
}: {
  appName: string;
  envName: string;
  context: Context;
  permission: TokenPermission;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
}): Promise<{
  appName: string;
  envName: string;
  token: string;
  permission: TokenPermission;
}> => {
  const app = await getApplicationByName({ context, clerkId, appName });

  const foundEnvironmentInApp = app.environments.find(
    (e) => e.name === envName,
  );

  if (!foundEnvironmentInApp) {
    throw new ServiceError(httpError.ENV_NOT_FOUND, 404);
  }

  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  const token = await tokenRepository.createTokenForAppOrEnvironment({
    permission,
    envId: foundEnvironmentInApp.id,
  });

  return {
    appName,
    envName,
    permission,
    token,
  };
};

const createTokenForEnvironment = async ({
  appName,
  envName,
  permission,
  context,
  tokenPermissions,
  clerkId,
}: {
  appName: string;
  envName: string;
  context: Context;
  permission: TokenPermission;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
}): Promise<{
  appName: string;
  envName: string;
  token: string;
  permission: TokenPermission;
}> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
  }

  if (clerkId) {
    return createTokenWithClerkIdForApplicationEnvironment({
      appName,
      envName,
      context,
      clerkId,
      permission,
    });
  }

  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);
  const tokenType = tokenPermissions!.applicationName
    ? "application"
    : "environment";

  let token = "";

  if (tokenType === "application") {
    const environment = await findEnvironment({ context, appName, envName });

    if (!environment) {
      throw new ServiceError(httpError.ENV_NOT_FOUND, 404);
    }

    token = await tokenRepository.createTokenForAppOrEnvironment({
      permission,
      envId: environment.id,
    });
  } else {
    token = await tokenRepository.createTokenForAppOrEnvironment({
      permission,
      envId: tokenPermissions!.environmentId!,
    });
  }

  return {
    appName,
    envName,
    permission,
    token,
  };
};

const createTokenForApplication = async ({
  appName,
  permission,
  context,
  tokenPermissions,
  clerkId,
}: {
  appName: string;
  context: Context;
  permission: TokenPermission;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
}): Promise<{
  appName: string;
  token: string;
  permission: TokenPermission;
}> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
  }
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  if (clerkId) {
    const app = await getApplicationByName({ context, clerkId, appName });

    const token = await tokenRepository.createTokenForAppOrEnvironment({
      permission,
      envId: app.id,
    });

    return {
      appName,
      permission,
      token,
    };
  }

  let token = "";

  if (tokenPermissions!.applicationId) {
    token = await tokenRepository.createTokenForAppOrEnvironment({
      permission,
      appId: tokenPermissions!.applicationId!,
    });
  } else {
    const app = await getApplicationByName({
      context,
      appName,
      tokenPermissions,
    });

    token = await tokenRepository.createTokenForAppOrEnvironment({
      permission,
      appId: app.id,
    });
  }

  return {
    appName,
    permission,
    token,
  };
};

export {
  getTokenPermissions,
  createTokenForEnvironment,
  createTokenForApplication,
};
