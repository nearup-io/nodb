import type Context from "../utils/context.ts";
import type { ITokenRepository } from "../repositories/interfaces.ts";
import { httpError, TOKEN_REPOSITORY } from "../utils/const.ts";
import type { BackendTokenPermissions } from "../utils/types.ts";
import type { TokenPermission } from "../models/token.model.ts";
import { getApplicationByName } from "./application.service.ts";
import { ServiceError } from "../utils/service-errors.ts";
import { findEnvironment } from "./environment.service.ts";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
    if (envName !== tokenPermissions!.environmentName) {
      throw new ServiceError(httpError.NO_PERMISSIONS_FOR_ENVIRONMENT, 403);
    }
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
      appId: app.id,
    });

    return {
      appName,
      permission,
      token,
    };
  }

  if (!tokenPermissions?.applicationId) {
    throw new ServiceError(httpError.NO_PERMISSIONS_FOR_APPLICATION, 403);
  }
  const token = await tokenRepository.createTokenForAppOrEnvironment({
    permission,
    appId: tokenPermissions!.applicationId!,
  });

  return {
    appName,
    permission,
    token,
  };
};

const deleteAppToken = async ({
  clerkId,
  context,
  tokenPermissions,
  appName,
  token,
}: {
  context: Context;
  appName: string;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
  token: string;
}): Promise<boolean> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
  }
  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  if (clerkId) {
    await getApplicationByName({ context, clerkId, appName });
  } else if (tokenPermissions) {
    if (
      !tokenPermissions.applicationId ||
      tokenPermissions.applicationName !== appName
    ) {
      throw new ServiceError(httpError.NO_PERMISSIONS_FOR_APPLICATION, 403);
    }
  }

  try {
    const result = await tokenRepository.deleteToken({
      token,
    });

    return result;
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      return false;
    }
    throw e;
  }
};

const deleteEnvironmentToken = async ({
  context,
  appName,
  envName,
  clerkId,
  tokenPermissions,
  token,
}: {
  context: Context;
  appName: string;
  envName: string;
  clerkId?: string;
  tokenPermissions?: BackendTokenPermissions;
  token: string;
}): Promise<boolean> => {
  if (!clerkId && !tokenPermissions) {
    throw new ServiceError(httpError.USER_NOT_AUTHENTICATED, 401);
  }

  const tokenRepository = context.get<ITokenRepository>(TOKEN_REPOSITORY);

  try {
    if (clerkId) {
      const app = await getApplicationByName({ context, clerkId, appName });

      const foundEnvironmentInApp = app.environments.find(
        (e) => e.name === envName,
      );

      if (!foundEnvironmentInApp) {
        throw new ServiceError(httpError.ENV_NOT_FOUND, 404);
      }
      const result = await tokenRepository.deleteToken({
        token,
      });
      return result;
    }

    const tokenType = tokenPermissions!.applicationName
      ? "application"
      : "environment";

    if (tokenType === "application") {
      const environment = await findEnvironment({ context, appName, envName });

      if (!environment) {
        throw new ServiceError(httpError.ENV_NOT_FOUND, 404);
      }
    } else {
      if (envName !== tokenPermissions!.environmentName) {
        throw new ServiceError(httpError.NO_PERMISSIONS_FOR_ENVIRONMENT, 403);
      }
    }
    const result = await tokenRepository.deleteToken({
      token,
    });
    return result;
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      return false;
    }
    throw e;
  }
};

export {
  deleteAppToken,
  deleteEnvironmentToken,
  getTokenPermissions,
  createTokenForEnvironment,
  createTokenForApplication,
};
